import { useUIMediaFolderStore, useUIMediaFolderStoreState } from "@/stores/uiMediaFolderStore"
import { useMediaMetadataQuery } from "@/hooks/mediaMetadata"
import { useSelectTvShowForFolderMutation } from "@/hooks/useSelectTvShowForFolderMutation"
import { normalizeMediaFolderPathForQuery } from "@/lib/mediaMetadataQueryKeys"
import { useState, useEffect, useCallback, useMemo } from "react"
import type { TMDBTVShow } from "@core/types"
import type { SearchResultSelectedArgs } from "./MediaDatabaseSearchbox"
import { useTranslation } from "@/lib/i18n"
import { TvShowPanelPrompts } from "./TvShowPanelPrompts"
import { useTvShowPromptsStore } from "@/stores/tvShowPromptsStore"
import { useTvShowPanelState } from "./hooks/useTvShowPanelState"
import { useRuleBasedRenameFilesFlow } from "./hooks/useRuleBasedRenameFilesFlow"
import { useRuleBasedRecognizeFlow } from "./hooks/useRuleBasedRecognizeFlow"
import { useAiBasedRenameFilesFlow } from "./hooks/useAiBasedRenameFilesFlow"
import { useAiBasedRecognizeFlow } from "./hooks/useAiBasedRecognizeFlow"
import { useSelectAndUnselectFileFlow } from "./hooks/useSelectAndUnselectFileFlow"
import { useResolvedLanguages } from "@/hooks/useResolvedLanguages"
import { useDialogs } from "@/providers/dialog-provider"
import { usePlansQuery } from "@/hooks/plans"
import { TvShowEpisodeTable, type TvShowEpisodeDataRow, type TvShowEpisodeTableRow } from "./TvShowEpisodeTable"
import { TvShowHeaderV2 } from "./TvShowHeaderV2"
import { MediaPanelInitializingHint } from "./MediaPanelInitializingHint"
import { TranscribeDialog, SubtitleTranslationDialog, SynthesizeSubtitleDialog, ProcessPipelineDialog } from "@/components/dialogs"
import { useFeatures } from "@/hooks/useFeatures"
import { useSubtitleFlow } from "@/hooks/useSubtitleFlow"
import { useFetchMediaMetadataMutation } from "@/hooks/mediaMetadata/useFetchMediaMetadataMutation"
import { buildTvShowEpisodeTableRows, buildTvShowEpisodeTableRowsForPlan } from "@/lib/buildTvShowEpisodeTableRows"
import { useLatest } from "react-use"
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"
import {
  TvShowAppPlanPromptProvider,
  type TvShowAppPlanPromptContextValue,
} from "@/components/plans/TvShowAppPlanPromptContext"
interface ToolbarOption {
  value: "plex" | "emby",
  label: string,
}

function TvShowPanel() {
  const { t } = useTranslation(['components', 'errors'])
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

  const mediaMetadata = useMemo((): UIMediaMetadata | undefined => {
    if (!selectedFolder?.trim()) return undefined

    const domain = queriedMediaMetadata

    const status: UIMediaMetadata["status"] = (() => {
      if (isMediaMetadataError) return "error_loading_metadata"
      if (domain) return "ok"
      if (uiFolderRow?.status) return uiFolderRow.status
      if (isMediaMetadataPending || mediaMetadataFetchStatus === "fetching") return "initializing"
      return "loading"
    })()

    if (!domain) {
      const normalizedPath = normalizeMediaFolderPathForQuery(selectedFolder)
      return {
        mediaFolderPath: normalizedPath,
        type: "tvshow-folder",
        status,
      } as UIMediaMetadata
    }

    return {
      ...domain,
      status,
    }
  }, [
    selectedFolder,
    queriedMediaMetadata,
    isMediaMetadataError,
    isMediaMetadataPending,
    mediaMetadataFetchStatus,
    uiFolderRow?.status,
  ])

  // Plans for the current folder, backed by TanStack Query.
  const { data: plans = [] } = usePlansQuery(mediaMetadata?.mediaFolderPath)

  const setSelectedByMediaFolderPath = useCallback((path: string) => {
    useUIMediaFolderStore.getState().applyFolderClick(path, false)
  }, [])
  const { selectTvShowForFolderMutation, updateMediaMetadata, persistUiMediaMetadata } =
    useSelectTvShowForFolderMutation()
  const { mutateAsync: fetchMediaMetadata } = useFetchMediaMetadataMutation()

  const [tableData, setTableData] = useState<TvShowEpisodeTableRow[]>([])
  const latestTableData = useLatest(tableData)

  const getSelectedEpisodePaths = useCallback(
    () =>
      latestTableData.current
        .filter((row): row is TvShowEpisodeDataRow => row.type === "episode" && row.checked)
        .map((row) => row.videoFile)
        .filter((path): path is string => path !== undefined),
    [],
  )

  const getSelectedEpisodes = useCallback(
    () =>
      latestTableData.current
        .filter((row): row is TvShowEpisodeDataRow => row.type === "episode" && row.checked)
        .map((row) => ({ season: row.season, episode: row.episode })),
    [],
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
  const { scrapeDialog, videoCompressionDialog } = useDialogs()
  const [openScrape] = scrapeDialog
  const { mediaLanguage } = useResolvedLanguages()

  const toolbarOptions: ToolbarOption[] = [
    { value: "plex", label: t('toolbar.plex') } as ToolbarOption,
    { value: "emby", label: t('toolbar.emby') } as ToolbarOption,
  ]

  const [episodeTableLayout, setEpisodeTableLayout] = useState<'simple' | 'detail' | 'preview'>('simple')

  const { isVideoCompressionEnabled } = useFeatures()

  const subtitleFlow = useSubtitleFlow({
    mediaMetadata,
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
    nfoData: import("@core/types").TMDBTVShowDetails
    onConfirm?: (tmdbTvShow: import("@core/types").TMDBTVShow) => void
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
    getSelectedEpisodePaths,
    persistUiMediaMetadata,
    namingRuleOptions: toolbarOptions,
    t: t as (key: string, options?: Record<string, unknown>) => string,
    onFlowStart: () => setEpisodeTableLayout("simple"),
  })

  const recognizeFlow = useRuleBasedRecognizeFlow({
    plans,
    mediaMetadata,
    getSelectedEpisodes,
    persistUiMediaMetadata,
    t: t as (key: string, options?: Record<string, unknown>) => string,
  })

  const plan = renameFlow.plan ?? recognizeFlow.plan

  useAiBasedRenameFilesFlow({
    plans,
    mediaMetadata,
    onAppRenameConfirm: renameFlow.onConfirm,
    setSelectedMediaMetadataByMediaFolderPath: setSelectedByMediaFolderPath,
    updateMediaMetadata,
    onFlowStart: () => setEpisodeTableLayout("simple"),
  })

  useAiBasedRecognizeFlow({
    activePlan: plan,
    mediaMetadata,
    persistUiMediaMetadata,
  })

  const selectFileFlow = useSelectAndUnselectFileFlow({
    mediaMetadata,
    updateMediaMetadata,
    t: t as (key: string, options?: Record<string, unknown>) => string,
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
  }, [plan, mediaMetadata?.mediaFolderPath])

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

  useEffect(() => {
    if (!mediaMetadata) return;

    let ret: TvShowEpisodeTableRow[] = [];
    if(plan === undefined) {
      ret = buildTvShowEpisodeTableRows(mediaMetadata, (key: string) => {
       return t(key as any)
      })
    } else {
      ret = buildTvShowEpisodeTableRowsForPlan(mediaMetadata, plan, (key: string) => {
       return t(key as any)
      })
    };

    setTableData(ret);
    
  }, [mediaMetadata, plan, t])

  const handleVideoCompressForRow = useCallback(
    (row: TvShowEpisodeDataRow) => {
      const seasonNo = row.season;
      const episodeNo = row.episode;
      const videoPath = mediaMetadata?.mediaFiles?.find(
        (f) => f.seasonNumber === seasonNo && f.episodeNumber === episodeNo,
      )?.absolutePath
      if (!videoPath) {
        console.warn(
          `[TvShowPanel] handleVideoCompressForRow: no video path found for season ${seasonNo} episode ${episodeNo}`,
        )
        return
      }
      const [openVideoCompression] = videoCompressionDialog
      openVideoCompression({
        filePath: videoPath,
        title: row.episodeTitle ?? `S${seasonNo}E${episodeNo}`,
      })
    },
    [mediaMetadata, videoCompressionDialog],
  )

  const appPlanPromptValue = useMemo((): TvShowAppPlanPromptContextValue => {
    return {
      appRenamePlan: renameFlow.plan,
      appRecognizePlan: recognizeFlow.plan,
      renameToolbarOptions: renameFlow.namingRuleOptions,
      selectedNamingRule: renameFlow.selectedNamingRule,
      setSelectedNamingRule: renameFlow.setSelectedNamingRule,
      onAppRenameNamingRuleSelected: renameFlow.onNamingRuleSelected,
      onAppRenameConfirm: renameFlow.onConfirm,
      onAppRenameCancel: renameFlow.onCancel,
      onAppRecognizeConfirm: recognizeFlow.onConfirm,
      onAppRecognizeCancel: recognizeFlow.onCancel,
      tvShowTitle: recognizeFlow.tvShowTitle,
      tvShowTmdbId: recognizeFlow.tvShowTmdbId,
      isRuleBasedRecognizeLoading: recognizeFlow.loading,
      notAllEpisodesRecognized: recognizeFlow.notAllEpisodesRecognized,
      allPlanFilesUnchanged: recognizeFlow.allPlanFilesUnchanged,
    }
  }, [renameFlow, recognizeFlow])

  return (
    <TvShowAppPlanPromptProvider value={appPlanPromptValue}>
    <div className='w-full h-full min-h-0 relative flex flex-col' data-testid="tv-show-panel">
      <TvShowPanelPrompts />

      <TranscribeDialog {...subtitleFlow.dialogs.transcribe} />
      <SubtitleTranslationDialog {...subtitleFlow.dialogs.translate} />
      <SynthesizeSubtitleDialog {...subtitleFlow.dialogs.synthesize} />
      <ProcessPipelineDialog {...subtitleFlow.dialogs.pipeline} />

      <div className="shrink-0 px-4 pt-4">
        <TvShowHeaderV2
          onSearchResultSelected={handleSelectResult}
          onRecognizeButtonClick={recognizeFlow.startRecognizeFlow}
          onRenameClick={renameFlow.startRenameFlow}
          selectedMediaMetadata={mediaMetadata}
          selectedMediaFolder={uiFolderRow}
          openScrape={openScrape}
          showSubtitleMenu={subtitleFlow.showSubtitleMenu}
          {...subtitleFlow.header}
          episodeTableLayout={episodeTableLayout}
          onEpisodeTableLayoutChange={setEpisodeTableLayout}
        />
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {mediaMetadata?.status === "initializing" ? (
          <MediaPanelInitializingHint />
        ) : (
          <TvShowEpisodeTable
            key={mediaMetadata?.mediaFolderPath ?? "no-folder"}
            data={tableData}
            mediaFolderPath={mediaMetadata?.mediaFolderPath}
            onSelectFileContextMenuClick={selectFileFlow.onSelectFileContextMenuClick}
            onUnlinkContextMenuClick={selectFileFlow.onUnlinkContextMenuClick}
            onVideoCompressContextMenuClick={
              isVideoCompressionEnabled ? handleVideoCompressForRow : undefined
            }
            preview={previewMode}
            previewStatus={previewStatus}
            layout={episodeTableLayout}
            onCheck={(row, checked) => {
              
              setTableData(prev => {
                return prev.map(r => {
                  if(r.type !== 'episode') return r;
                  if(r.season !== row.season || r.episode !== row.episode) return r;
                  return {
                    ...r,
                    checked: checked,
                  }
                })
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
