import { useUIMediaFolderStore, useUIMediaFolderStoreState } from "@/stores/uiMediaFolderStore"
import { useMediaMetadataQuery } from "@/hooks/mediaMetadata"
import { useSelectTvShowForFolderMutation } from "@/hooks/useSelectTvShowForFolderMutation"
import { normalizeMediaFolderPathForQuery } from "@/lib/mediaMetadataQueryKeys"
import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import type { TMDBTVShow } from "@core/types"
import type { SearchResultSelectedArgs } from "./MediaDatabaseSearchbox"
import { buildTemporaryRecognitionPlanAsync, handlePendingPlans, unlinkEpisode, mediaFolderPathEqual, applyRecognizeMediaFilePlan, rebuildPlanWithSelectedEpisodes } from "./TvShowPanelUtils"
import { handleAiRecognizeConfirm } from "@/actions/handleAiRecognizeConfirm"
import { cleanupRecognizePlan } from "@/ai/tools/EndRecognizeTask"
import { cleanupRenamePlan } from "@/ai/tools/EndRenameFilesTask"
import type { UIRecognizeMediaFilePlan } from "@/types/UIRecognizeMediaFilePlan"

import { nextTraceId } from "@/lib/utils"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"
import { TvShowPanelPrompts } from "./TvShowPanelPrompts"
import { useTvShowPromptsStore } from "@/stores/tvShowPromptsStore"
import { useTvShowPanelState } from "./hooks/useTvShowPanelState"
import { useTvShowFileNameGeneration } from "./hooks/useTvShowFileNameGeneration"
import { useTvShowWebSocketEvents } from "./hooks/useTvShowWebSocketEvents"
import { useTmdbQueries } from "@/hooks/useTmdbQueries"
import { useConfig } from "@/hooks/userConfig"
import { useResolvedLanguages } from "@/hooks/useResolvedLanguages"
import { useDialogs } from "@/providers/dialog-provider"
import { Path } from "@core/path"
import { usePlansStore, type UIPlan } from "@/stores/plansStore"
import type { RecognizeMediaFilePlan } from "@core/types/RecognizeMediaFilePlan"
import type { UIRenameFilesPlan } from "@/types/UIRenameFilesPlan"
import { useTmdbIdFromFolderNamePromptStore } from "@/stores/useTmdbIdFromFolderNamePromptStore"
import { TvShowEpisodeTable, type TvShowEpisodeDataRow, type TvShowEpisodeTableRow } from "./TvShowEpisodeTable"
import { TvShowHeaderV2 } from "./TvShowHeaderV2"
import { MediaPanelInitializingHint } from "./MediaPanelInitializingHint"
import { TranscribeDialog, SubtitleTranslationDialog, SynthesizeSubtitleDialog, ProcessPipelineDialog } from "@/components/dialogs"
import { transcribeDialogRowsFromMediaFiles } from "@/lib/transcribeDialogRows"
import { subtitleTranslationDialogRowsFromMediaFiles } from "@/lib/subtitleTranslationDialogRows"
import { synthesizeSubtitleDialogRowsFromMediaFiles } from "@/lib/synthesizeSubtitleDialogRows"
import { processPipelineDialogRowsFromMediaFiles } from "@/lib/processPipelineDialogRows"
import { useVideoCaptionerStatus } from "@/hooks/useVideoCaptionerStatus"
import { useFeatures } from "@/hooks/useFeatures"
import { openNativeOpenDialog } from "@/lib/nativeFolderDialog"
import { isElectron } from "@/lib/isElectron"
import { useJobs } from "@/hooks/useJobOrchestrator"
import { useFetchMediaMetadataMutation } from "@/hooks/mediaMetadata/useFetchMediaMetadataMutation"
import type { MediaMetadata } from "@core/types"
import { buildTvShowEpisodeTableRows, buildTvShowEpisodeTableRowsForPlan } from "@/lib/buildTvShowEpisodeTableRows"
import { useLatest } from "react-use"
import { fetchPlans } from "@/actions/planActions"
import { handleRenamePromptConfirmForTvShow } from "@/actions/handleRenamePromptConfirmForTvShow"
import { renameFiles } from "@/api/renameFiles"
import { handleEpisodeFileSelect as handleEpisodeFileSelectHelper } from "@/helpers/TvShowPanel/handleEpisodeFileSelect"
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"
interface ToolbarOption {
  value: "plex" | "emby",
  label: string,
}

function TvShowPanel() {
  const { t } = useTranslation(['components', 'errors'])
  const { plans, setPlans, setPlanById, getPlanById } = usePlansStore()
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

  const setSelectedByMediaFolderPath = useCallback((path: string) => {
    useUIMediaFolderStore.getState().applyFolderClick(path, false)
  }, [])
  const { selectTvShowForFolderMutation, updateMediaMetadata, persistUiMediaMetadata } =
    useSelectTvShowForFolderMutation()
  const { mutateAsync: fetchMediaMetadata } = useFetchMediaMetadataMutation()

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
  const { filePickerDialog, scrapeDialog, mediaFilePropertyDialog, videoCompressionDialog } = useDialogs()
  const [openFilePicker] = filePickerDialog
  const [openScrape] = scrapeDialog
  const [openMediaFileProperty] = mediaFilePropertyDialog
  const { userConfig } = useConfig()
  const { mediaLanguage } = useResolvedLanguages()
  const { getTvShowById } = useTmdbQueries()

  const toolbarOptions: ToolbarOption[] = [
    { value: "plex", label: t('toolbar.plex') } as ToolbarOption,
    { value: "emby", label: t('toolbar.emby') } as ToolbarOption,
  ]

  const [episodeTableLayout, setEpisodeTableLayout] = useState<'simple' | 'detail' | 'preview'>('simple')

  const { isAiFeatureEnabled, isTranscribeEnabled, isTencentAsrTranscribeEnabled, isSubtitleFeaturesEnabled, isVideoCompressionEnabled } = useFeatures()
  const { isAvailable: isVideoCaptionerReady } = useVideoCaptionerStatus()
  const isTranscribeAvailable =
    isSubtitleFeaturesEnabled &&
    isTranscribeEnabled &&
    (isVideoCaptionerReady || isTencentAsrTranscribeEnabled)
  const [isTranscribeOpen, setIsTranscribeOpen] = useState(false)
  const transcribeDialogRows = useMemo(
    () => transcribeDialogRowsFromMediaFiles(mediaMetadata),
    [mediaMetadata],
  )
  const hasTranscribeTargets = transcribeDialogRows.length > 0

  const subtitleTranslationDialogRows = useMemo(
    () =>
      subtitleTranslationDialogRowsFromMediaFiles(
        mediaMetadata?.status === "ok" ? (mediaMetadata as MediaMetadata) : undefined,
      ),
    [mediaMetadata],
  )
  const hasTranslateTargets = subtitleTranslationDialogRows.some((r) => r.eligible)
  const isTranslateAvailable = isSubtitleFeaturesEnabled && isVideoCaptionerReady

  const synthesizeSubtitleDialogRows = useMemo(
    () =>
      synthesizeSubtitleDialogRowsFromMediaFiles(
        mediaMetadata?.status === "ok" ? (mediaMetadata as MediaMetadata) : undefined,
      ),
    [mediaMetadata],
  )
  const hasSynthesizeTargets = synthesizeSubtitleDialogRows.some((r) => r.eligible)
  const isSynthesizeAvailable = isSubtitleFeaturesEnabled && isVideoCaptionerReady

  const processPipelineRows = useMemo(
    () =>
      processPipelineDialogRowsFromMediaFiles(
        mediaMetadata?.status === "ok" ? (mediaMetadata as MediaMetadata) : undefined,
      ),
    [mediaMetadata],
  )
  const hasProcessTargets = processPipelineRows.length > 0
  const isProcessAvailable =
    isSubtitleFeaturesEnabled && isTranscribeEnabled && isVideoCaptionerReady

  const allJobRecords = useJobs()
  const runningJobIdsRef = useRef(new Set<string>())
  const fetchMediaMetadataRef = useRef(fetchMediaMetadata)
  fetchMediaMetadataRef.current = fetchMediaMetadata
  const mediaFolderPathRef = useRef(mediaMetadata?.mediaFolderPath)
  mediaFolderPathRef.current = mediaMetadata?.mediaFolderPath

  useEffect(() => {
    const mfp = mediaFolderPathRef.current
    if (!mfp) { runningJobIdsRef.current = new Set(); return }
    const platformFolder = Path.toPlatformPath(mfp)
    const hadCompletion = allJobRecords.some(
      (r) =>
        r.folder === platformFolder &&
        (r.status === "succeeded" || r.status === "failed") &&
        runningJobIdsRef.current.has(r.id),
    )
    if (hadCompletion) void fetchMediaMetadataRef.current({ path: mfp })
    runningJobIdsRef.current = new Set(
      allJobRecords.filter((r) => r.folder === platformFolder && r.status === "running").map((r) => r.id),
    )
  }, [allJobRecords])

  const [isSubtitleTranslationOpen, setIsSubtitleTranslationOpen] = useState(false)
  const [isSynthesizeSubtitleOpen, setIsSynthesizeSubtitleOpen] = useState(false)
  const [isProcessPipelineOpen, setIsProcessPipelineOpen] = useState(false)
  const openUseNfoPrompt = useTvShowPromptsStore((state) => state.openUseNfoPrompt)
  const openRuleBasedRenameFilePrompt = useTvShowPromptsStore((state) => state.openRuleBasedRenameFilePrompt)
  const openAiBasedRenameFilePrompt = useTvShowPromptsStore((state) => state.openAiBasedRenameFilePrompt)
  const openAiBasedRecognizePrompt = useTvShowPromptsStore((state) => state.openAiBasedRecognizePrompt)
  const openRuleBasedRecognizePrompt = useTvShowPromptsStore((state) => state.openRuleBasedRecognizePrompt)
  const ruleBasedRecognizePrompt = useTvShowPromptsStore((state) => state.ruleBasedRecognizePrompt)
  const closeAiBasedRenameFilePrompt = useTvShowPromptsStore((state) => state.closeAiBasedRenameFilePrompt)
  const closeAiBasedRecognizePrompt = useTvShowPromptsStore((state) => state.closeAiBasedRecognizePrompt)
  const updateAiBasedRenameFileStatus = useTvShowPromptsStore((state) => state.updateAiBasedRenameFileStatus)

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

  const handleUseTmdbidFromFolderNameConfirm = useCallback((tmdbTvShow: TMDBTVShow) => {
    console.log('[TvShowPanel] handleUseTmdbidFromFolderNameConfirm CALLED', {
      timestamp: new Date().toISOString(),
      tmdbTvShow,
      tmdbTvShowId: tmdbTvShow?.id,
      stackTrace: new Error().stack
    })
    if (!tmdbTvShow || !tmdbTvShow.id) {
      console.error('[TvShowPanel] handleUseTmdbidFromFolderNameConfirm called with invalid tmdbTvShow:', tmdbTvShow)
      return
    }
    console.log(`[TvShowPanel] loaded TMDB id from folder name: ${tmdbTvShow.id}`);
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

  // Use state hook
  const {
    selectedNamingRule,
    setSelectedNamingRule,
  } = useTvShowPanelState({ 
    mediaMetadata, 
    toolbarOptions, 
    usePrompts: { 
      openUseNfoPrompt: openUseNfoPromptWithCallbacks
    } 
  })

  // Use file name generation hook
  const { generateNewFileNames } = useTvShowFileNameGeneration({
    mediaMetadata,
    selectedNamingRule,
  })


  const tmdbPromptStore = useTmdbIdFromFolderNamePromptStore()

  const handleTmdbIdDetected = useCallback(async (tmdbId: number) => {
    tmdbPromptStore.openPrompt({
      tmdbId,
      mediaName: undefined,
      status: "loading",
      onConfirm: handleUseTmdbidFromFolderNameConfirm,
      onCancel: () => {},
    })

    try {
      // const details = await getTvShowById(tmdbId, language)
      
      // if (details) {
      //   tmdbPromptStore.openPrompt({
      //     tmdbId,
      //     mediaName: details.name,
      //     status: "ready",
      //     onConfirm: handleUseTmdbidFromFolderNameConfirm,
      //     onCancel: () => {},
      //   })
      // } else {
      //   tmdbPromptStore.openPrompt({
      //     tmdbId,
      //     mediaName: undefined,
      //     status: "error",
      //     onConfirm: handleUseTmdbidFromFolderNameConfirm,
      //     onCancel: () => {},
      //   })
      //   toast.error(t('toolbar.queryTmdbFailed'))
      // }
    } catch (error) {
      console.error('Failed to get TV show by ID:', error)
      tmdbPromptStore.openPrompt({
        tmdbId,
        mediaName: undefined,
        status: "error",
        onConfirm: handleUseTmdbidFromFolderNameConfirm,
        onCancel: () => {},
      })
      toast.error(t('toolbar.queryTmdbFailed'))
    }
  }, [getTvShowById, handleUseTmdbidFromFolderNameConfirm, t])

  useEffect(() => {

    if(mediaMetadata?.status !== 'ok') {
      return
    }

    if(mediaMetadata?.tvShow !== undefined) {
      return
    }

    // const detection = startToRecognizeByTmdbIdInFolderName(mediaMetadata, userConfig)
    // if (detection) {
    //   handleTmdbIdDetected(detection.tmdbId, detection.language)
    // }
  }, [mediaMetadata, userConfig, handleTmdbIdDetected])

  const handleAiRecognizeConfirmCallback = useCallback(async (plan: RecognizeMediaFilePlan) => {
    if (!isAiFeatureEnabled || !mediaMetadata) return
    await handleAiRecognizeConfirm(plan, mediaMetadata, persistUiMediaMetadata, setPlanById)
    const uiPlan = plan as UIRecognizeMediaFilePlan
    if (uiPlan.tmp === true) {
      await cleanupRecognizePlan(plan.id)
    }
  }, [isAiFeatureEnabled, mediaMetadata, persistUiMediaMetadata, setPlanById])

  const handleRuleBasedRecognizePromptConfirmButtonClick = useCallback(async (plan: UIRecognizeMediaFilePlan) => {
    console.log('[TvShowPanel] User clicked the confirm button in RuleBasedRecognizePrompt', structuredClone(plan))
    if (!mediaMetadata) {
      toast.error("No media metadata available")
      return
    }

    if (!plan || !plan.mediaFolderPath) {
      toast.error("Plan not found or invalid")
      return
    }

    try {
      const selectedEpisodes = latestTableData.current
        .filter((row): row is TvShowEpisodeDataRow => row.type === 'episode' && row.checked)
        .map(row => ({ season: row.season, episode: row.episode }))

      const actualPlan = rebuildPlanWithSelectedEpisodes(plan as RecognizeMediaFilePlan, selectedEpisodes)
      const traceId = `TvShowPanel-handleRuleBasedRecognizeConfirm-${nextTraceId()}`
      await applyRecognizeMediaFilePlan(actualPlan, mediaMetadata, persistUiMediaMetadata, { traceId })
      setPlanById(plan.id, { status: 'completed' })
      
      toast.success(t('toolbar.recognizeEpisodesSuccess'))
    } catch (error) {
      console.error('[TvShowPanel] Error applying rule-based recognition:', error)
      toast.error("Failed to apply recognition")
    }
  }, [mediaMetadata, persistUiMediaMetadata, t])

  // When panel shows a media folder, fetch pending plans so we can open the right prompt (rename or recognize)
  useEffect(() => {

    if (mediaMetadata?.mediaFolderPath) {
      fetchPlans().then((plans) => {
        setPlans(plans)
      })
    }
    
  }, [mediaMetadata?.mediaFolderPath, setPlans])

  const handleRenamePromptConfirm = useCallback(async (planId: string) => {
    const plan = getPlanById(planId)

    if (!plan) {
      console.error("[TvShowPanel] No temporary rename plan found")
      toast.error("Failed to find rename plan")
      return
    }

    await handleRenamePromptConfirmForTvShow(
      {
        planId,
        plan: plan as UIRenameFilesPlan,
        mediaMetadata: mediaMetadata!,
        selectedEpisodePaths: latestTableData.current
          .filter((row): row is TvShowEpisodeDataRow => row.type === 'episode' && row.checked)
          .map(row => row.videoFile)
          .filter(path => path !== undefined),
        renameFailedLabel: t('episodeFile.renameFailed'),
        noMediaPathErrorLabel: t('movie.noMediaPathError'),
      },
      {
        setPlanById,
        persistUiMediaMetadata,
        renameFilesApi: renameFiles,
        cleanupRenamePlan,
      },
    )
  }, [mediaMetadata, getPlanById, setPlanById, persistUiMediaMetadata, t])

  /**
   * Open AI based rename file prompt (only when AI features are enabled)
   */
  useEffect(() => {
    if (!isAiFeatureEnabled || !mediaMetadata?.mediaFolderPath) {
      if (!isAiFeatureEnabled) {
        closeAiBasedRenameFilePrompt()
      }
      return
    }
    const plan = plans.find(
      (p): p is UIRenameFilesPlan => 
        p.task === "rename-files" &&
        p.status === "pending" &&
        mediaFolderPathEqual(p.mediaFolderPath, mediaMetadata.mediaFolderPath)
    )
    if (plan) {
      console.log(`[TvShowPanel] Detected pending RenameFilesPlan, open AiBasedRenameFilePrompt:`, plan)
      setEpisodeTableLayout('simple')
      openAiBasedRenameFilePrompt({
        status: "wait-for-ack",
        onConfirm: () => handleRenamePromptConfirm(plan.id),
        onCancel: async () => {
          try {
            setPlanById(plan.id, { status: "rejected" })
            if (plan.tmp) {
              await cleanupRenamePlan(plan.id)
            }
          } catch (error) {
            console.error("[TvShowPanel] Error rejecting rename plan:", error)
          }
        },
      })
    } else {
      closeAiBasedRenameFilePrompt()
      // Do not close recognize prompt here; handlePendingPlans manages AiBasedRecognizePrompt.
    }
  }, [isAiFeatureEnabled, plans, mediaMetadata, openAiBasedRenameFilePrompt, closeAiBasedRenameFilePrompt, handleRenamePromptConfirm])

  // Use WebSocket events hook
  useTvShowWebSocketEvents({
    mediaMetadata,
    setSelectedMediaMetadataByMediaFolderPath: setSelectedByMediaFolderPath,
    openAiBasedRenameFilePrompt,
    setAiBasedRenameFileStatus: updateAiBasedRenameFileStatus,
    updateMediaMetadata,
  })

  const requireMediaMetadata = useCallback(() => {
    if (!mediaMetadata) {
      toast.error("No media metadata available")
      console.error("No media metadata available")
      return
    }

    if (!mediaMetadata.mediaFolderPath) {
      toast.error("No media folder path available")
      console.error("No media folder path available")
      return
    }

    return mediaMetadata
  }, [mediaMetadata])

  // Handle file selection for episode
  const handleEpisodeFileSelect = useCallback((seasonNumber: number, episodeNumber: number, file: { path: string; isDirectory?: boolean }) => {
    // Don't allow selecting directories
    if (file.isDirectory) {
      toast.error(t('tvShowEpisodeTable.linkFileDirectoryError'))
      return
    }

    const currentMediaMetadata = requireMediaMetadata();
    if (!currentMediaMetadata) {
      return
    }

    const traceId = `UserLinkFileToEpisode-${nextTraceId()}`

    const updated = handleEpisodeFileSelectHelper(
      currentMediaMetadata,
      seasonNumber,
      episodeNumber,
      file.path,
      (errorMessage) => {
        toast.error(errorMessage)
      }
    )

    // If helper returns the same object, treat it as no-op (likely due to error)
    if (updated === currentMediaMetadata) {
      return
    }

    updateMediaMetadata(currentMediaMetadata.mediaFolderPath!, updated, { traceId })
  }, [mediaMetadata, updateMediaMetadata, requireMediaMetadata, t])

  const handleOpenFilePickerForEpisode = useCallback((seasonNumber: number, episodeNumber: number) => {
    // Validate mediaMetadata is available
    if (!mediaMetadata?.mediaFolderPath) {
      toast.error("No media metadata available")
      return
    }

    // In test environment, allow mocking file picker result via localStorage
    if (typeof window !== 'undefined') {
      try {
        const mockFilePick = window.localStorage.getItem('test.mockFilePick')
        console.log(`[Mock] mock file pick: ${mockFilePick}`)
        if (mockFilePick && mockFilePick.trim().length > 0) {
          const selectedFile = {
            path: mockFilePick,
            isDirectory: false,
          }
          handleEpisodeFileSelect(seasonNumber, episodeNumber, selectedFile)
          return
        }
      } catch (error) {
        console.error('[handleOpenFilePickerForEpisode] Failed to read localStorage.test.mockFilePick:', error)
      }
    }

    // Convert media folder path from POSIX to platform-specific format for the file picker
    const mediaFolderPlatformPath = Path.toPlatformPath(mediaMetadata.mediaFolderPath)
    if (isElectron()) {
      void openNativeOpenDialog({
        properties: ['openFile'],
        title: "Select Video File",
        defaultPath: mediaFolderPlatformPath,
        filters: [
          { name: 'Video Files', extensions: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'ts'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      }).then((selectedFile) => {
        if (selectedFile) {
          handleEpisodeFileSelect(seasonNumber, episodeNumber, selectedFile)
        }
      }).catch((error: Error) => {
        console.error('[handleOpenFilePickerForEpisode] Error opening native dialog:', error)
        toast.error(`Failed to open file dialog: ${error.message}`)
      })
    } else {
      // Use custom file picker dialog in web environment
      const fileSelectHandler = (selectedFile: { path: string; isDirectory?: boolean }) => {
        handleEpisodeFileSelect(seasonNumber, episodeNumber, selectedFile)
      }

      openFilePicker(fileSelectHandler, {
        title: "Select Video File",
        description: "Choose a video file for this episode",
        selectFolder: false,
        initialPath: mediaFolderPlatformPath
      })
    }
  }, [mediaMetadata, openFilePicker, handleEpisodeFileSelect])

  // Handler for rule-based recognition button click
  const handleRuleBasedRecognizeButtonClick = useCallback(() => {
    if (!mediaMetadata?.mediaFolderPath) {
      toast.error("No media folder path available")
      return
    }

    const traceId = `RecognizeEpisodes-${nextTraceId()}`

    // 1. Add tmp plan with loading state so RuleBasedRecognizePrompt shows immediately
    const newPlan: UIRecognizeMediaFilePlan = {
      id: crypto.randomUUID(),
      task: 'recognize-media-file',
      status: 'loading',
      tmp: true,
      mediaFolderPath: mediaMetadata.mediaFolderPath,
      files: [],
    }

    console.log(`[TvShowPanel] openRuleBasedRecognizePrompt() CALLED`)
    openRuleBasedRecognizePrompt({
      tvShowTitle: mediaMetadata.tvShow?.name ?? '',
      tvShowTmdbId: parseInt(mediaMetadata.tvShow?.id ?? '0'),
      planId: newPlan.id,
      onConfirm: () => {
        console.log(`[TvShowPanel] RuleBasedRecognizePrompt.onConfirm() CALLED`)
        handleRuleBasedRecognizePromptConfirmButtonClick?.(getPlanById(newPlan.id) as UIRecognizeMediaFilePlan)
      },
      onCancel: () => {
        setPlanById(newPlan.id, { status: 'rejected' })
      }
    })
    setPlans(prev => [...prev, newPlan])
    console.log(`[TvShowPanel] setPlans: `, structuredClone(plans))
   
    // 2. Run recognition in background, then update plan with result
    void buildTemporaryRecognitionPlanAsync(mediaMetadata)
      .then(planData => {
        console.log(`[${traceId}] recognize episodes: `, structuredClone(planData))

        if (planData && planData.files.length > 0) {
          setPlanById(newPlan.id, { status: 'pending', files: planData.files })
        } else {
          setPlanById(newPlan.id, { status: 'rejected' })
          toast.error(t('toast.noRecognizedFiles', { defaultValue: 'Unable to recognize any episodes. Consider using AI to recognize instead.' }))
        }
      })
      .catch(err => {
        setPlanById(newPlan.id, { status: 'rejected' })
        toast.error(err instanceof Error ? err.message : 'Recognition failed')
      })
  }, [mediaMetadata, t])

  const [tableData, setTableData] = useState<TvShowEpisodeTableRow[]>([]);
  const latestTableData = useLatest(tableData)

  const plan = useMemo(() => {
    if(plans.length > 0) {
      
      const plansForThisFolder = plans
          .filter(p => mediaFolderPathEqual(p.mediaFolderPath, mediaMetadata?.mediaFolderPath))
          .filter(p => p.status === 'pending' || p.status === 'loading')

      if(plansForThisFolder.length === 0) {
        return undefined;
      }

      console.log(`Found active plan: `, plansForThisFolder[0])
      return plansForThisFolder[0]

    }
    return undefined;
  }, [plans, mediaMetadata?.mediaFolderPath])

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
    if(plan.status === 'loading') {
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

  const handleUnlinkEpisode = useCallback(
    (row: TvShowEpisodeDataRow) => {
      unlinkEpisode({
        season: row.season,
        episode: row.episode,
        mediaMetadata,
        updateMediaMetadata,
        t: t as (key: string, options?: Record<string, unknown>) => string,
      })
    },
    [mediaMetadata, updateMediaMetadata, t]
  )

  const handlePropertiesForRow = useCallback(
    (row: TvShowEpisodeDataRow) => {
      const seasonNo = row.season;
      const episodeNo = row.episode;

      const videoPath = mediaMetadata?.mediaFiles?.find(f => f.seasonNumber === seasonNo && f.episodeNumber === episodeNo)?.absolutePath
      if (videoPath) {
        openMediaFileProperty({
          filePath: videoPath,
          track: {
            id: 0,
            title: row.episodeTitle ?? `S${seasonNo}E${episodeNo}`,
          },
        })
      } else {
        console.warn(`[TvShowPanel] handlePropertiesForRow: no video path found for season ${seasonNo} episode ${episodeNo}`)
      }
    },
    [mediaMetadata, openMediaFileProperty]
  )

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
  
  /**
   * Hanlde the event of user click "Select File" context menu in TvShowEpisodeTable
   * App pop up the file-picker-dialog or native file-picker dialog to let user select the video file
   * And then update the mediaMetadata.mediaFiles with the selected video file path for given season and episode
   */
  const handleSelectFileContextMenuClick = useCallback((row: TvShowEpisodeDataRow) => {
      const seasonNo = row.season;
      const episodeNo = row.episode;
      handleOpenFilePickerForEpisode(seasonNo, episodeNo)
  }, [mediaMetadata])

  useEffect(() => {
    if(plan !== undefined) {

      if(plan.status !== 'pending') {
        return;
      }

      if(plan.task === 'recognize-media-file' && plan.tmp === true) {
        const isHandledByRuleBasedPrompt =
          ruleBasedRecognizePrompt.isOpen &&
          ruleBasedRecognizePrompt.planId === plan.id
        if (isHandledByRuleBasedPrompt) {
          return
        }
      }

      console.log(`[TvShowPanel] useEffect handlePendingPlans CALLED: `, structuredClone(plan))
      handlePendingPlans({
        pendingPlans: [plan],
        mediaMetadata,
        openRuleBasedRecognizePrompt,
        openAiBasedRecognizePrompt,
        closeAiBasedRecognizePrompt,
        handleAiRecognizeConfirmCallback,
        handleRuleBasedRecognizeConfirmCallback: handleRuleBasedRecognizePromptConfirmButtonClick,
        updatePlan: (planId, status) => {
          setPlanById(planId, { status })
          return Promise.resolve()
        },
        toast,
        isAiFeatureEnabled,
      })
    }
  }, [plan, ruleBasedRecognizePrompt.isOpen, ruleBasedRecognizePrompt.planId])

  const handleHeaderTranslateClick = useCallback(() => {
    if (!hasTranslateTargets) {
      toast.error("No subtitle files available to translate.")
      return
    }
    setIsSubtitleTranslationOpen(true)
  }, [hasTranslateTargets])

  const handleHeaderSynthesizeClick = useCallback(() => {
    if (!hasSynthesizeTargets) {
      toast.error("No video and subtitle pairs available to synthesize.")
      return
    }
    setIsSynthesizeSubtitleOpen(true)
  }, [hasSynthesizeTargets])

  const handleHeaderProcessClick = useCallback(() => {
    if (!hasProcessTargets) {
      toast.error("No media files available for the pipeline.")
      return
    }
    setIsProcessPipelineOpen(true)
  }, [hasProcessTargets])

  return (
    <div className='w-full h-full min-h-0 relative flex flex-col' data-testid="tv-show-panel">
      <TvShowPanelPrompts />

      <TranscribeDialog
        isOpen={isTranscribeOpen}
        onClose={() => setIsTranscribeOpen(false)}
        rows={transcribeDialogRows}
        folder={
          mediaMetadata?.mediaFolderPath
            ? Path.toPlatformPath(mediaMetadata.mediaFolderPath)
            : undefined
        }
      />
      <SubtitleTranslationDialog
        isOpen={isSubtitleTranslationOpen}
        onClose={() => setIsSubtitleTranslationOpen(false)}
        rows={subtitleTranslationDialogRows}
        folder={
          mediaMetadata?.mediaFolderPath
            ? Path.toPlatformPath(mediaMetadata.mediaFolderPath)
            : undefined
        }
      />
      <SynthesizeSubtitleDialog
        isOpen={isSynthesizeSubtitleOpen}
        onClose={() => setIsSynthesizeSubtitleOpen(false)}
        rows={synthesizeSubtitleDialogRows}
        folder={
          mediaMetadata?.mediaFolderPath
            ? Path.toPlatformPath(mediaMetadata.mediaFolderPath)
            : undefined
        }
      />
      <ProcessPipelineDialog
        isOpen={isProcessPipelineOpen}
        onClose={() => setIsProcessPipelineOpen(false)}
        rows={processPipelineRows}
        folder={
          mediaMetadata?.mediaFolderPath
            ? Path.toPlatformPath(mediaMetadata.mediaFolderPath)
            : undefined
        }
      />

      <div className="shrink-0 px-4 pt-4">
        <TvShowHeaderV2
          onSearchResultSelected={handleSelectResult}
          onRecognizeButtonClick={handleRuleBasedRecognizeButtonClick}
          onRenameClick={() => {

            if (!mediaMetadata?.mediaFolderPath) {
              toast.error("No media folder path available")
              return
            }

            setEpisodeTableLayout('simple')
            
            // 1. Add tmp plan with loading state so RuleBasedRenameFilePrompt shows immediately
            const newPlan: UIPlan = {
              id: crypto.randomUUID(),
              task: 'rename-files',
              status: 'loading',
              tmp: true,
              mediaFolderPath: mediaMetadata.mediaFolderPath,
              files: [],
            };
            setPlans(prev => [...prev, newPlan]);

            console.log(`[TvShowPanel] created new tmp rename plan: ${newPlan.id}`);

            openRuleBasedRenameFilePrompt({
              toolbarOptions,
              selectedNamingRule,
              setSelectedNamingRule,
              planId: newPlan.id,
              onConfirm: () => {
                handleRenamePromptConfirm(newPlan.id)
              },
              onCancel: async () => {
                try {
                  await setPlanById(newPlan.id,{ status: 'rejected' })
                } catch (error) {
                  console.error("[TvShowPanel] Error rejecting rename plan:", error)
                }
              },
              onNamingRulesSelected: async (rule) => {
                console.log(`[TvShowPanel] onNamingRulesSelected: ${rule}`)
                try {
                  // Generate new file names based on selected rule

                  // TODO: update plan to loading status
                  const renamePlan = generateNewFileNames(rule)
                  console.log(`[TvShowPanel] generated rename plan by naming rule ${rule}: `, structuredClone(renamePlan))

                  
                  if (renamePlan) {
                    // Update the temporary plan with the rename data
                    await setPlanById(newPlan.id, {
                      status: 'pending',
                      files: renamePlan.files
                    })
                  } else {
                    await setPlanById(newPlan.id, { status: 'rejected' })
                  }
                } catch (error) {
                  console.error("[TvShowPanel] Error generating file names:", error)
                  await setPlanById(newPlan.id, { status: 'rejected' })
                }
              },
            })
          }}
          selectedMediaMetadata={mediaMetadata}
          selectedMediaFolder={uiFolderRow}
          openScrape={openScrape}
          showSubtitleMenu={isSubtitleFeaturesEnabled}
          onTranscribeClick={() => setIsTranscribeOpen(true)}
          onTranslateClick={handleHeaderTranslateClick}
          onSynthesizeClick={handleHeaderSynthesizeClick}
          onProcessClick={handleHeaderProcessClick}
          isTranscribeAvailable={isTranscribeAvailable}
          hasTranscribeTargets={hasTranscribeTargets}
          isTranslateAvailable={isTranslateAvailable}
          hasTranslateTargets={hasTranslateTargets}
          isSynthesizeAvailable={isSynthesizeAvailable}
          hasSynthesizeTargets={hasSynthesizeTargets}
          isProcessAvailable={isProcessAvailable}
          hasProcessTargets={hasProcessTargets}
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
            onSelectFileContextMenuClick={handleSelectFileContextMenuClick}
            onUnlinkContextMenuClick={handleUnlinkEpisode}
            onPropertiesContextMenuClick={handlePropertiesForRow}
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
  )
}

export default TvShowPanel
