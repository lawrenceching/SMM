import { useUIMediaFolderStoreState } from "@/stores/uiMediaFolderStore"
import { useMediaMetadataQuery } from "@/hooks/mediaMetadata"
import { useSelectTvShowForFolderMutation } from "@/hooks/useSelectTvShowForFolderMutation"
import { normalizeMediaFolderPathForQuery } from "@/lib/mediaMetadataQueryKeys"
import { useState, useCallback, useMemo } from "react"
import type { MediaMetadata } from "@/lib/mediaFolderFiles"
import { useMediaFolderFilesQuery } from "@/hooks/useMediaFolderFilesQuery"
import type { TMDBTVShow, TMDBTVShowDetails } from "@smm/types"
import type { SearchResultSelectedArgs } from "../MediaDatabaseSearchbox"
import { useTvShowPromptsStore } from "@/stores/tvShowPromptsStore"
import { useTvShowPanelState } from "@/hooks/tv/useTvShowPanelState"
import { useTvShowEpisodeVideoCompress } from "@/hooks/tv/useTvShowEpisodeVideoCompress"
import { useTvShowEpisodeFormatConvert } from "@/hooks/tv/useTvShowEpisodeFormatConvert"
import { useRuleBasedRenameFilesFlow } from "@/hooks/tv/useRuleBasedRenameFilesFlow"
import { useRuleBasedRecognizeFlow } from "@/hooks/tv/useRuleBasedRecognizeFlow"
import { useAiBasedRenameEpisodeFlow } from "@/hooks/tv/useAiBasedRenameEpisodeFlow"
import { useAiBasedRecognizeEpisodeFlow } from "@/hooks/tv/useAiBasedRecognizeEpisodeFlow"
import { useSelectAndUnselectFileFlow } from "@/hooks/tv/useSelectAndUnselectFileFlow"
import { useResolvedLanguages } from "@/hooks/useResolvedLanguages"
import { askForRenameFile, askForScrape } from "@/lib/dialogRequestEvents"
import { MediaFileTable } from "@/components/media/MediaFileTable"
import type {
  MediaFileTableContextMenuProps,
  UIMediaFileTableRow,
  UIMediaEpisodeSelection,
} from "@/components/media/UIMediaFileTable"
import { useRenameVideoFileFlow } from "@/hooks/useRenameVideoFileFlow"
import { MediaFileTableToolbar } from "@/components/media/MediaFileTableToolbar"
import { useTvShowMediaFileTableToolbar } from "@/hooks/tv/useTvShowMediaFileTableToolbar"
import { MediaPanelInitializingHint } from "../MediaPanelInitializingHint"
import { TranscribeDialog, SubtitleTranslationDialog, SynthesizeSubtitleDialog, ProcessPipelineDialog } from "@/components/dialogs"
import { useFeatures } from "@/hooks/useFeatures"
import { useSubtitleFlow } from "@/hooks/useSubtitleFlow"
import { useFetchMediaMetadataMutation } from "@/hooks/mediaMetadata/useFetchMediaMetadataMutation"
import {
  rebuildPlanWithSelectedEpisodes,
  buildRenameApplySelectedFiles,
  buildRecognizeApplySelectedFiles,
  buildMediaFileTableSeasonData,
} from "./TvShowPanelUtils"
import type { UIMediaFolderStatus } from "@/types/UIMediaFolder"
import { useTvShowPanel } from "@/hooks/useTvShowPanel"
import { RuleBasedRenameFilePrompt } from "../RuleBasedRenameFilePrompt"
import { RuleBasedRecognizePrompt } from "./RuleBasedRecognizePrompt"
import { AiBasedRenameEpisodePrompt } from "./AiBasedRenameEpisodePrompt"
import { AiBasedRecognizeEpisodePrompt } from "./AiBasedRecognizeEpisodePrompt"
import type { RecognizeMediaFilePlan } from "@smm/types/RecognizeMediaFilePlan"


function TvShowPanel() {
  const { folders, selectedFolder } = useUIMediaFolderStoreState()
  const {
    data: queriedMediaMetadata,
    isError: isMediaMetadataError,
    isPending: isMediaMetadataPending,
    fetchStatus: mediaMetadataFetchStatus,
  } = useMediaMetadataQuery(selectedFolder || undefined)
 
  const uiFolderRow = useMemo(
    () =>
      selectedFolder
        ? folders.find(
            (f) =>
              normalizeMediaFolderPathForQuery(f.path) ===
              normalizeMediaFolderPathForQuery(selectedFolder),
          )
        : undefined,
    [folders, selectedFolder],
  )

  const { data: folderFiles = [] } = useMediaFolderFilesQuery(selectedFolder || undefined)

  const mediaMetadata: MediaMetadata | undefined = queriedMediaMetadata ?? undefined

  const uiStatus: UIMediaFolderStatus = useMemo(() => {
    if (isMediaMetadataError) return "error_loading_metadata"
    if (mediaMetadata) return "ok"
    if (isMediaMetadataPending || mediaMetadataFetchStatus === "fetching") return "initializing"
    return uiFolderRow?.status ?? "loading"
  }, [
    isMediaMetadataError,
    mediaMetadata,
    isMediaMetadataPending,
    mediaMetadataFetchStatus,
    uiFolderRow?.status,
  ])

  const { selectTvShowForFolderMutation, updateMediaMetadata } =
    useSelectTvShowForFolderMutation()
  const { mutateAsync: fetchMediaMetadata } = useFetchMediaMetadataMutation()
  const videoRenameFlow = useRenameVideoFileFlow({
    mediaFolderPath: mediaMetadata?.mediaFolderPath,
    openRenameDialog: askForRenameFile,
  })

  const [tableData] = useState<UIMediaFileTableRow[]>([])

  // Checkbox selection — separate UI state, kept apart from row data so that
  // user toggles survive the row rebuilds triggered by metadata / plan refetches.
  const [selectedEpisodes, setSelectedEpisodes] = useState<UIMediaEpisodeSelection[]>([])

  const getSelectedEpisodes = useCallback(
    () => selectedEpisodes,
    [selectedEpisodes],
  )

  const recognizeBeforeConfirm = useCallback(
    (plan: RecognizeMediaFilePlan) =>
      rebuildPlanWithSelectedEpisodes(plan, getSelectedEpisodes()),
    [getSelectedEpisodes],
  )

  const handleSelectResult = useCallback(
    (args: SearchResultSelectedArgs) => {
      const path = mediaMetadata?.mediaFolderPath
      if (!path) {
        console.error(`[TvShowPanel] handleSelectResult called with no mediaFolderPath`)
        return
      }
      selectTvShowForFolderMutation.mutate({ mediaFolderPath: path, ...args })
    },
    [mediaMetadata?.mediaFolderPath, selectTvShowForFolderMutation],
  )
  
  const { mediaLanguage } = useResolvedLanguages()

  const [episodeTableLayout, setEpisodeTableLayout] = useState<'simple' | 'detail' | 'preview'>('simple')

  const { isVideoCompressionEnabled, isFormatConverterEnabled } = useFeatures()
  const { handleVideoCompressForRow } = useTvShowEpisodeVideoCompress(mediaMetadata)
  const { handleFormatConvertForRow } = useTvShowEpisodeFormatConvert(mediaMetadata)

  const mediaFileTableSeasonData = useMemo(() => {
    return mediaMetadata ? buildMediaFileTableSeasonData(mediaMetadata) : []
  }, [mediaMetadata])

  const subtitleFlow = useSubtitleFlow({
    mediaMetadata,
    uiStatus,
    onRefreshMediaMetadata: (path) => void fetchMediaMetadata({ path }),
  })

  const openUseNfoPrompt = useTvShowPromptsStore((state) => state.openUseNfoPrompt)

  // Callback handlers for prompts
  const handleUseNfoConfirm = useCallback((tmdbTvShow: TMDBTVShow) => {
    console.log('[TvShowPanel] handleUseNfoConfirm CALLED', {
      timestamp: new Date().toISOString(),
      tmdbTvShow,
      tmdbTvShowId: tmdbTvShow?.id,
      stackTrace: new Error().stack
    })
    if (!tmdbTvShow || !tmdbTvShow.id) {
      console.error('[TvShowPanel] handleUseNfoConfirm called with invalid tmdbTvShow:', tmdbTvShow)
      return
    }
    console.log(`[TvShowPanel] loaded TMDB id from tvshow.nfo: ${tmdbTvShow.id}`);
    handleSelectResult({ database: 'TMDB', result: tmdbTvShow, searchLanguage: mediaLanguage })
  }, [handleSelectResult, mediaLanguage])

  // Memoize the wrapped openUseNfoPrompt to avoid recreating it on every render
  const openUseNfoPromptWithCallbacks = useCallback((params: {
    nfoData: TMDBTVShowDetails
    onConfirm?: (tmdbTvShow: TMDBTVShow) => void
    onCancel?: () => void
  }) => {
    console.log('[TvShowPanel] openUseNfoPromptWithCallbacks CALLED', {
      timestamp: new Date().toISOString(),
      nfoDataId: params.nfoData?.id,
      hasOriginalOnConfirm: !!params.onConfirm,
      stackTrace: new Error().stack
    })
    openUseNfoPrompt({
      ...params,
      onConfirm: handleUseNfoConfirm,
      onCancel: () => {},
    })
  }, [openUseNfoPrompt, handleUseNfoConfirm])

  // Use state hook (folder-change side effects)
  useTvShowPanelState({
    mediaMetadata,
    usePrompts: {
      openUseNfoPrompt: openUseNfoPromptWithCallbacks,
    },
  })

  const renameFlow = useRuleBasedRenameFilesFlow({
    mediaMetadata,
  })

  const aiRenameFlow = useAiBasedRenameEpisodeFlow({
    mediaMetadata,
    onFlowStart: () => setEpisodeTableLayout("simple"),
  })

  const recognizeFlow = useRuleBasedRecognizeFlow({
    mediaMetadata,
  })

  const aiRecognizeFlow = useAiBasedRecognizeEpisodeFlow({
    mediaMetadata,
    beforeConfirm: recognizeBeforeConfirm,
    onFlowStart: () => setEpisodeTableLayout("simple"),
  })

  const plan =
    renameFlow.plan ??
    recognizeFlow.plan ??
    aiRenameFlow.plan ??
    aiRecognizeFlow.plan

  const { metadataFiles, subtitleFiles, nfoFiles, thumbnailFiles, newFilePaths } = useTvShowPanel(selectedFolder, plan)

  const selectFileFlow = useSelectAndUnselectFileFlow({
    mediaMetadata,
    folderFiles,
    updateMediaMetadata,
  })


  const contextMenuProps: MediaFileTableContextMenuProps = useMemo(
    () => ({
      renameMenuVisible: true,
      onRenameMenuClick: videoRenameFlow.onRenameContextMenuClick,
      selectFileMenuVisible: true,
      onSelectFileMenuClick: selectFileFlow.onSelectFileContextMenuClick,
      unlinkMenuVisible: true,
      onUnlinkMenuClick: selectFileFlow.onUnlinkContextMenuClick,
      videoCompressMenuVisible: isVideoCompressionEnabled,
      onVideoCompressMenuClick: handleVideoCompressForRow,
      formatConvertMenuVisible: isFormatConverterEnabled,
      onFormatConvertMenuClick: handleFormatConvertForRow,
    }),
    [
      videoRenameFlow.onRenameContextMenuClick,
      selectFileFlow.onSelectFileContextMenuClick,
      selectFileFlow.onUnlinkContextMenuClick,
      handleVideoCompressForRow,
      handleFormatConvertForRow,
      isVideoCompressionEnabled,
      isFormatConverterEnabled,
    ],
  )

  const planId = useMemo(() => { return plan?.id ?? '' }, [plan])
  // null sentinel so the first render with an already-pending plan still seeds selection
  // (useState(planId) would skip sync when plan is present on mount).
  const [syncedPlanId, setSyncedPlanId] = useState<string | null>(null)

  // Adjust checkbox selection when the active plan changes (React: adjust state during render).
  if (planId !== syncedPlanId) {
    setSyncedPlanId(planId)

    if (plan && plan.id === planId && plan.status === 'pending') {
      if (plan.task === 'rename-files') {
        const episodes =
          mediaMetadata?.mediaFiles
            ?.filter(f => f.seasonNumber !== undefined && f.episodeNumber !== undefined)
            ?.map(f => ({ season: f.seasonNumber!, episode: f.episodeNumber! })) ?? []
        setSelectedEpisodes(episodes)
      } else if (plan.task === 'recognize-media-file') {
        const recognizePlan = plan as RecognizeMediaFilePlan
        const episodes = recognizePlan.files
          .map(f => ({ season: f.season, episode: f.episode }))
          .filter(f =>
            mediaMetadata?.tvShow?.seasons
              ?.find(s => s.season === f.season)
              ?.episodes?.find(e => e.episode === f.episode),
          )
        setSelectedEpisodes(episodes)
      }
    }
  }

  const ruleBasedRenameFilePromptProps = useMemo(() => {
    return {
      loading: renameFlow.loading,
      isOpen: renameFlow.open,
      namingRuleOptions: renameFlow.namingRuleOptions,
      selectedNamingRule: renameFlow.selectedNamingRule,
      onNamingRulesSelected: renameFlow.selectNamingRule,
      isConfirmButtonDisabled: renameFlow.isConfirmButtonDisabled,
      onConfirm: async () => {
        // RENAME applies to files already linked in metadata, so each checked
        // episode's table path (metadata.mediaFiles[...].absolutePath) is the
        // plan entry's `from`. RECOGNIZE must not use this table lookup —
        // see buildRecognizeApplySelectedFiles.
        const selectedFiles = buildRenameApplySelectedFiles(
          mediaFileTableSeasonData,
          selectedEpisodes,
        )

        renameFlow.confirm(selectedFiles)
      },
      onCancel: () => {
        void renameFlow.cancel()
      },
    }
  }, [renameFlow, mediaFileTableSeasonData, selectedEpisodes])

  const ruleBasedRecognizePromptProps = useMemo(() => {
    return {
      isOpen: recognizeFlow.open,
      isLoading: recognizeFlow.loading,
      tvShowTitle: recognizeFlow.tvShowTitle,
      tvShowTmdbId: recognizeFlow.tvShowTmdbId,
      notAllEpisodesRecognized: recognizeFlow.notAllEpisodesRecognized,
      allPlanFilesUnchanged: recognizeFlow.allPlanFilesUnchanged,
      isConfirmButtonDisabled: recognizeFlow.isConfirmButtonDisabled,
      onConfirm: async () => {
        // RECOGNIZE applies plan-proposed paths: the files are usually NOT yet
        // linked in metadata, so the episode-table lookup used by RENAME would
        // drop them. The selection must resolve through recognizeFlow.plan.files.
        const selectedFiles = buildRecognizeApplySelectedFiles(
          recognizeFlow.plan,
          selectedEpisodes,
        )
        await recognizeFlow.confirm(selectedFiles)
      },
      onCancel: () => {
        void recognizeFlow.cancel()
      },
    }
  }, [recognizeFlow, selectedEpisodes])

  const mediaFileTableToolbarProps = useTvShowMediaFileTableToolbar({
    onSearchResultSelected: handleSelectResult,
    onRecognizeButtonClick: recognizeFlow.start,
    onRenameClick: renameFlow.start,
    selectedMediaMetadata: mediaMetadata,
    selectedMediaFolder: uiFolderRow,
    openScrape: askForScrape,
    showSubtitleMenu: subtitleFlow.showSubtitleMenu,
    ...subtitleFlow.header,
    episodeTableLayout,
    onEpisodeTableLayoutChange: setEpisodeTableLayout,
  })

  return (
    <div className='w-full h-full min-h-0 relative flex flex-col' data-testid="tv-show-panel">
      {/* <TvShowPanelPrompts /> */}

      <RuleBasedRenameFilePrompt {...ruleBasedRenameFilePromptProps}/>
      <RuleBasedRecognizePrompt {...ruleBasedRecognizePromptProps} />
      <AiBasedRenameEpisodePrompt {...aiRenameFlow.promptProps} />
      <AiBasedRecognizeEpisodePrompt {...aiRecognizeFlow.promptProps} />

      <TranscribeDialog {...subtitleFlow.dialogs.transcribe} />
      <SubtitleTranslationDialog {...subtitleFlow.dialogs.translate} />
      <SynthesizeSubtitleDialog {...subtitleFlow.dialogs.synthesize} />
      <ProcessPipelineDialog {...subtitleFlow.dialogs.pipeline} />

      <div className="shrink-0 px-4 pt-4">
        <MediaFileTableToolbar {...mediaFileTableToolbarProps} />
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {uiStatus === "initializing" ? (
          <MediaPanelInitializingHint />
        ) : (
          <MediaFileTable
            key={mediaMetadata?.mediaFolderPath ?? "no-folder"}
            seasonData={mediaFileTableSeasonData}
            metadataFiles={metadataFiles}
            subtitleFiles={subtitleFiles}
            nfoFiles={nfoFiles}
            thumbnailFiles={thumbnailFiles}
            data={tableData}
            mediaFolderPath={mediaMetadata?.mediaFolderPath}
            layout={episodeTableLayout}
            contextMenuProps={contextMenuProps}
            selectedEpisodes={selectedEpisodes}
            newFilePaths={newFilePaths}
            checboxVisible={plan !== undefined}
            onCheck={(season, episode, checked) => {
              setSelectedEpisodes(prev => {
                return checked
                  ? prev.some(e => e.season === season && e.episode === episode)
                    ? prev
                    : [...prev, { season, episode }]
                  : prev.some(e => e.season === season && e.episode === episode)
                    ? prev.filter(e => e.season !== season || e.episode !== episode)
                    : prev
              })
            }}
          />
        )}
      </div>
    </div>
  )
}

export default TvShowPanel
