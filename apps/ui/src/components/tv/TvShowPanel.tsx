import { useUIMediaFolderStore, useUIMediaFolderStoreState } from "@/stores/uiMediaFolderStore"
import { useMediaMetadataQuery } from "@/hooks/mediaMetadata"
import { useSelectTvShowForFolderMutation } from "@/hooks/useSelectTvShowForFolderMutation"
import { normalizeMediaFolderPathForQuery } from "@/lib/mediaMetadataQueryKeys"
import { useState, useCallback, useMemo } from "react"
import type { MediaMetadata } from "@/lib/mediaFolderFiles"
import { useMediaFolderFilesQuery } from "@/hooks/useMediaFolderFilesQuery"
import type { TMDBTVShow, TMDBTVShowDetails } from "@smm/types"
import type { SearchResultSelectedArgs } from "../MediaDatabaseSearchbox"
import { TvShowPanelPrompts } from "./TvShowPanelPrompts"
import { useTvShowPromptsStore } from "@/stores/tvShowPromptsStore"
import { useTvShowPanelState } from "@/hooks/tv/useTvShowPanelState"
import { useTvShowEpisodeVideoCompress } from "@/hooks/tv/useTvShowEpisodeVideoCompress"
import { useTvShowEpisodeFormatConvert } from "@/hooks/tv/useTvShowEpisodeFormatConvert"
import { useRuleBasedRenameFilesFlow } from "@/hooks/tv/useRuleBasedRenameFilesFlow"
import { useRuleBasedRecognizeFlow } from "@/hooks/tv/useRuleBasedRecognizeFlow"
import { useAiBasedRenameFilesFlow } from "@/hooks/tv/useAiBasedRenameFilesFlow"
import { useAiBasedRecognizeFlow } from "@/hooks/tv/useAiBasedRecognizeFlow"
import { useSelectAndUnselectFileFlow } from "@/hooks/tv/useSelectAndUnselectFileFlow"
import { useResolvedLanguages } from "@/hooks/useResolvedLanguages"
import { askForRenameFile, askForScrape } from "@/lib/dialogRequestEvents"
import { usePlansQuery } from "@/hooks/plans"
import { MediaFileTable } from "@/components/media/MediaFileTable"
import type {
  MediaFileTableContextMenuProps,
  UIMediaFileDataRow,
  UIMediaFileTableRow,
  UIMediaEpisodeSelection,
  MediaFileTableSeasonData,
} from "@/components/media/UIMediaFileTable"
import { useRenameVideoFileFlow } from "@/hooks/useRenameVideoFileFlow"
import { TvShowPanelHeader } from "./TvShowPanelHeader"
import { MediaPanelInitializingHint } from "../MediaPanelInitializingHint"
import { TranscribeDialog, SubtitleTranslationDialog, SynthesizeSubtitleDialog, ProcessPipelineDialog } from "@/components/dialogs"
import { useFeatures } from "@/hooks/useFeatures"
import { useSubtitleFlow } from "@/hooks/useSubtitleFlow"
import { useFetchMediaMetadataMutation } from "@/hooks/mediaMetadata/useFetchMediaMetadataMutation"
import {
  rebuildPlanWithSelectedEpisodes,
  rebuildRenamePlanWithSelectedEpisodes,
} from "./TvShowPanelUtils"
import { useLatest } from "react-use"
import type { UIMediaFolderStatus } from "@/types/UIMediaFolder"
import type { UIRecognizeMediaFilePlan } from "@/types/UIRecognizeMediaFilePlan"
import type { UIRenameFilesPlan } from "@/types/UIRenameFilesPlan"
import {
  TvShowAppPlanPromptProvider,
  type TvShowAppPlanPromptContextValue,
} from "./plans/TvShowAppPlanPromptContext"
import { useTvShowPanel } from "@/hooks/useTvShowPanel"


export function buildMediaFileTableSeasonData(m: MediaMetadata): MediaFileTableSeasonData[] {

  if(m.type === 'tvshow-folder' || m.type === 'movie-folder') {
    const seasons: MediaFileTableSeasonData[] = m.tvShow?.seasons?.map(s => {
      return {
        season: s.season,
        title: s.name,
        episodes: s.episodes.map(e => {
          return {
            season: s.season,
            episode: e.episode,
            title: e.name,
            path: m.mediaFiles?.find(f => f.seasonNumber === s.season && f.episodeNumber === e.episode)?.absolutePath,
          }
        }),
      }
    }) ?? [];

    return seasons;
  }

  // Should NOT reach this line in normal case.
  console.warn(`Unsupported media type: ${m.type}, returned dummy MediaFileTableSeasonData`)
  return []
}

function TvShowPanel() {
  const { folders, selectedFolder } = useUIMediaFolderStoreState()
  const {
    data: queriedMediaMetadata,
    isError: isMediaMetadataError,
    isPending: isMediaMetadataPending,
    fetchStatus: mediaMetadataFetchStatus,
  } = useMediaMetadataQuery(selectedFolder || undefined)

  const { metadataFiles, subtitleFiles, nfoFiles, thumbnailFiles } = useTvShowPanel(selectedFolder)
 
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

  // Plans for the current folder, backed by TanStack Query.
  const { data: plans = [] } = usePlansQuery(mediaMetadata?.mediaFolderPath)

  const setSelectedByMediaFolderPath = useCallback((path: string) => {
    useUIMediaFolderStore.getState().applyFolderClick(path, false)
  }, [])
  const { selectTvShowForFolderMutation, updateMediaMetadata } =
    useSelectTvShowForFolderMutation()
  const { mutateAsync: fetchMediaMetadata } = useFetchMediaMetadataMutation()
  const videoRenameFlow = useRenameVideoFileFlow({
    mediaFolderPath: mediaMetadata?.mediaFolderPath,
    openRenameDialog: askForRenameFile,
  })

  const [tableData] = useState<UIMediaFileTableRow[]>([])
  const latestTableData = useLatest(tableData)

  // Checkbox selection — separate UI state, kept apart from row data so that
  // user toggles survive the row rebuilds triggered by metadata / plan refetches.
  const [selectedEpisodes, setSelectedEpisodes] = useState<UIMediaEpisodeSelection[]>([])

  const getSelectedEpisodePaths = useCallback(
    () =>
      selectedEpisodes
        .map(({ season, episode }) => {
          const row = latestTableData.current.find(
            (r): r is UIMediaFileDataRow =>
              r.type === "episode" && r.season === season && r.episode === episode,
          )
          return row?.videoFile
        })
        .filter((path): path is string => path !== undefined),
    [selectedEpisodes, latestTableData],
  )

  const getSelectedEpisodes = useCallback(
    () => selectedEpisodes,
    [selectedEpisodes],
  )

  const recognizeBeforeConfirm = useCallback(
    (plan: UIRecognizeMediaFilePlan) =>
      rebuildPlanWithSelectedEpisodes(plan, getSelectedEpisodes()),
    [getSelectedEpisodes],
  )

  const renameBeforeConfirm = useCallback(
    (plan: UIRenameFilesPlan) =>
      rebuildRenamePlanWithSelectedEpisodes(plan, getSelectedEpisodePaths()),
    [getSelectedEpisodePaths],
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
    return !!mediaMetadata ? buildMediaFileTableSeasonData(mediaMetadata) : []
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
    plans,
    mediaMetadata,
    uiStatus,
    beforeConfirm: renameBeforeConfirm,
    onFlowStart: () => setEpisodeTableLayout("simple"),
  })

  const aiRenameFlow = useAiBasedRenameFilesFlow({
    plans,
    mediaMetadata,
    onAppRenameConfirm: renameFlow.onConfirm,
    setSelectedMediaMetadataByMediaFolderPath: setSelectedByMediaFolderPath,
    onFlowStart: () => setEpisodeTableLayout("simple"),
  })

  const recognizeFlow = useRuleBasedRecognizeFlow({
    plans,
    mediaMetadata,
    uiStatus,
    beforeConfirm: recognizeBeforeConfirm,
  })

  const aiRecognizeFlow = useAiBasedRecognizeFlow({
    plans,
    mediaMetadata,
    beforeConfirm: recognizeBeforeConfirm,
    onFlowStart: () => setEpisodeTableLayout("simple"),
  })

  const plan =
    renameFlow.plan ??
    aiRenameFlow.plan ??
    recognizeFlow.plan ??
    aiRecognizeFlow.plan

  const selectFileFlow = useSelectAndUnselectFileFlow({
    mediaMetadata,
    folderFiles,
    updateMediaMetadata,
  })

  const previewMode: "rename" | "recognize" | undefined = useMemo(() => {

    if(plan === undefined) {
      return undefined;
    }

    const task = plan.task;
    if(task === 'recognize-media-file') {
      return 'recognize';
    } else if(task === 'rename-files') {
      return 'rename';
    } else {
      console.warn(`[TvShowPanel] previewMode: unknown plan task: ${task}`)
      return undefined;
    }
  }, [plan])

  const previewStatus: "loading" | "ok" | undefined = useMemo(() => {
    if(plan === undefined) {
      return undefined;
    }
    if(plan.status === 'preparing') {
      return 'loading';
    } else {
      return 'ok';
    }
  }, [plan])

  // useEffect(() => {
  //   /* eslint-disable react-hooks/set-state-in-effect */
  //   if (!mediaMetadata) return;

  //   const built = buildTvShowEpisodeTableRowsForPanel(mediaMetadata, uiStatus, plan, (key: string) => {
  //     return t(key as any) // eslint-disable-line @typescript-eslint/no-explicit-any
  //   }, folderFiles)

  //   setTableData(built.rows);

  //   // Re-seed the selection only when a (new) plan instance arrives. The
  //   // selection is separate UI state, so unrelated row rebuilds (metadata /
  //   // folderFiles refetches) must not wipe the user's check toggles.
  //   if (plan !== prevPlanRef.current) {
  //     prevPlanRef.current = plan
  //     setSelectedEpisodes(built.defaultChecked)
  //   }
  //   /* eslint-enable react-hooks/set-state-in-effect */

  // }, [mediaMetadata, plan, uiStatus, t, folderFiles])

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

  const appPlanPromptValue = useMemo((): TvShowAppPlanPromptContextValue => {
    return {
      appRenamePlan: renameFlow.plan,
      appRecognizePlan: recognizeFlow.plan,
      aiRenamePlan: aiRenameFlow.plan,
      aiRenamePromptStatus: aiRenameFlow.promptStatus,
      aiRecognizePlan: aiRecognizeFlow.plan,
      aiRecognizePromptStatus: aiRecognizeFlow.promptStatus,
      renameToolbarOptions: renameFlow.namingRuleOptions,
      selectedNamingRule: renameFlow.selectedNamingRule,
      setSelectedNamingRule: renameFlow.setSelectedNamingRule,
      onAppRenameNamingRuleSelected: renameFlow.onNamingRuleSelected,
      onAppRenameConfirm: renameFlow.onConfirm,
      onAppRenameCancel: renameFlow.onCancel,
      onAiRenameConfirm: aiRenameFlow.onConfirm,
      onAiRenameCancel: aiRenameFlow.onCancel,
      onAiRecognizeConfirm: aiRecognizeFlow.onConfirm,
      onAiRecognizeCancel: aiRecognizeFlow.onCancel,
      onAppRecognizeConfirm: recognizeFlow.onConfirm,
      onAppRecognizeCancel: recognizeFlow.onCancel,
      tvShowTitle: recognizeFlow.tvShowTitle,
      tvShowTmdbId: recognizeFlow.tvShowTmdbId,
      isRuleBasedRecognizeLoading: recognizeFlow.loading,
      notAllEpisodesRecognized: recognizeFlow.notAllEpisodesRecognized,
      allPlanFilesUnchanged: recognizeFlow.allPlanFilesUnchanged,
      allRenamePlanFilesUnchanged: renameFlow.allRenamePlanFilesUnchanged,
    }
  }, [renameFlow, aiRenameFlow, aiRecognizeFlow, recognizeFlow])

  

  return (
    <TvShowAppPlanPromptProvider value={appPlanPromptValue}>
    <div className='w-full h-full min-h-0 relative flex flex-col' data-testid="tv-show-panel">
      <TvShowPanelPrompts />

      <TranscribeDialog {...subtitleFlow.dialogs.transcribe} />
      <SubtitleTranslationDialog {...subtitleFlow.dialogs.translate} />
      <SynthesizeSubtitleDialog {...subtitleFlow.dialogs.synthesize} />
      <ProcessPipelineDialog {...subtitleFlow.dialogs.pipeline} />

      <div className="shrink-0 px-4 pt-4">
        <TvShowPanelHeader
          onSearchResultSelected={handleSelectResult}
          onRecognizeButtonClick={recognizeFlow.startRecognizeFlow}
          onRenameClick={renameFlow.startRenameFlow}
          selectedMediaMetadata={mediaMetadata}
          selectedMediaFolder={uiFolderRow}
          openScrape={askForScrape}
          showSubtitleMenu={subtitleFlow.showSubtitleMenu}
          {...subtitleFlow.header}
          episodeTableLayout={episodeTableLayout}
          onEpisodeTableLayoutChange={setEpisodeTableLayout}
        />
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
            preview={previewMode}
            previewStatus={previewStatus}
            layout={episodeTableLayout}
            contextMenuProps={contextMenuProps}
            selectedEpisodes={selectedEpisodes}
            onCheck={(row, checked) => {
              setSelectedEpisodes((prev) => {
                const exists = prev.some(
                  (e) => e.season === row.season && e.episode === row.episode,
                )
                if (checked === exists) return prev
                if (checked) return [...prev, { season: row.season, episode: row.episode }]
                return prev.filter(
                  (e) => !(e.season === row.season && e.episode === row.episode),
                )
              })
            }}
          />
        )}
      </div>
    </div>
    </TvShowAppPlanPromptProvider>
  )
}

export default TvShowPanel
