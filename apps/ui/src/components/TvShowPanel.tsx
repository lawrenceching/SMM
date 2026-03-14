import { TVShowHeader } from "./tv-show-header"
import { SeasonSection } from "./season-section"
import { useMediaMetadataStoreState, useMediaMetadataStoreActions } from "@/stores/mediaMetadataStore"
import { useMediaMetadataActions } from "@/actions/mediaMetadataActions"
import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import type { TMDBEpisode, TMDBTVShow, TMDBMovie } from "@core/types"
import type { FileProps } from "@/lib/types"
import { nextTraceId } from "@/lib/utils"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"
import { recognizeEpisodes, updateMediaFileMetadatas, buildSeasonsByRecognizeMediaFilePlan, buildSeasonsByRenameFilesPlan, executeRenamePlan, buildTemporaryRecognitionPlanAsync, recognizeMediaFilesByRulesAsync, buildSeasonsModelFromMediaMetadata, handleAiRecognizeConfirm, handlePendingPlans, onMediaFolderSelected, unlinkEpisode, mediaFolderPathEqual } from "./TvShowPanelUtils"
import { TvShowPanelPrompts } from "./TvShowPanelPrompts"
import { useTvShowPromptsStore } from "@/stores/tvShowPromptsStore"
import { useTvShowPanelState } from "./hooks/useTvShowPanelState"
import { useTvShowFileNameGeneration } from "./hooks/useTvShowFileNameGeneration"
import { useTvShowRenaming } from "./hooks/useTvShowRenaming"
import { useTvShowWebSocketEvents } from "./hooks/useTvShowWebSocketEvents"
import { getTvShowById, getTMDBImageUrl } from "@/api/tmdb"
import { useConfig } from "@/providers/config-provider"
import { mapSearchLanguageToTmdb } from "./TMDBSearchbox"
import type { SupportedLanguage } from "@/lib/i18n"
import { useDialogs } from "@/providers/dialog-provider"
import { Path } from "@core/path"
import { usePlansStore } from "@/stores/plansStore"
import type { RecognizeMediaFilePlan } from "@core/types/RecognizeMediaFilePlan"
import type { RenameFilesPlan } from "@core/types/RenameFilesPlan"
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"
import { useTmdbIdFromFolderNamePromptStore } from "@/stores/useTmdbIdFromFolderNamePromptStore"
import { startToRecognizeByTmdbIdInFolderName } from "./hooks/startToRecognizeByTmdbIdInFolderName"
import { TvShowEpisodeTable, type TvShowEpisodeTableRow, type TvShowFolderFileRow } from "./TvShowEpisodeTable"
import { basename } from "@/lib/path"
import { TvShowHeaderV2 } from "./TvShowHeaderV2"
import { MediaPanelInitializingHint } from "./MediaPanelInitializingHint"

const v2 = true;

export interface EpisodeModel {
    episode: TMDBEpisode,
    files: FileProps[],
}

export interface SeasonModel {
    season: import("@core/types").TMDBSeason,
    episodes: EpisodeModel[],
}


interface ToolbarOption {
  value: "plex" | "emby",
  label: string,
}

const FOLDER_FILE_IDS: TvShowFolderFileRow["id"][] = ["clearlogo", "fanart", "poster", "theme", "nfo"]

function matchFolderFile(files: string[], id: TvShowFolderFileRow["id"]): string | undefined {
  if (!files.length) return undefined
  if (id === "nfo") {
    return files.find((f) => basename(f) === "tvshow.nfo")
  }
  const prefix = `${id}.`
  return files.find((f) => {
    const name = basename(f)
    return name != null && name.startsWith(prefix)
  })
}

function buildFolderFileRows(files: string[]): TvShowFolderFileRow[] {
  const rows: TvShowFolderFileRow[] = []
  for (const id of FOLDER_FILE_IDS) {
    const path = matchFolderFile(files, id)
    if (path) rows.push({ id, type: "folderFile", path })
  }
  return rows
}

function TvShowPanel() {
  const { t } = useTranslation(['components', 'errors'])
  const { pendingPlans, pendingRenamePlans, updatePlan, fetchPendingPlans, addTmpPlan, updateTmpPlan } = usePlansStore()
  const { selectedMediaMetadata: mediaMetadata } = useMediaMetadataStoreState()
  const { setSelectedByMediaFolderPath } = useMediaMetadataStoreActions()
  const { updateMediaMetadata, refreshMediaMetadata } = useMediaMetadataActions()
  const { filePickerDialog, scrapeDialog, editMediaFileDialog } = useDialogs()
  const [openFilePicker] = filePickerDialog
  const [openScrape] = scrapeDialog
  const [openEditMediaFile] = editMediaFileDialog
  const { userConfig } = useConfig()
  
  const isElectron = typeof window !== 'undefined' && typeof (window as any).electron !== 'undefined'
  
  const toolbarOptions: ToolbarOption[] = [
    { value: "plex", label: t('toolbar.plex') } as ToolbarOption,
    { value: "emby", label: t('toolbar.emby') } as ToolbarOption,
  ]

  const [episodeTableLayout, setEpisodeTableLayout] = useState<'simple' | 'detail' | 'preview'>('simple')

  useEffect(() => {
    console.log("[TvShowPanel] selected media folder changed: ", mediaMetadata)
  }, [mediaMetadata])

  const openUseNfoPrompt = useTvShowPromptsStore((state) => state.openUseNfoPrompt)
  const openRuleBasedRenameFilePrompt = useTvShowPromptsStore((state) => state.openRuleBasedRenameFilePrompt)
  const openAiBasedRenameFilePrompt = useTvShowPromptsStore((state) => state.openAiBasedRenameFilePrompt)
  const openAiBasedRecognizePrompt = useTvShowPromptsStore((state) => state.openAiBasedRecognizePrompt)
  const openRuleBasedRecognizePrompt = useTvShowPromptsStore((state) => state.openRuleBasedRecognizePrompt)
  const closeAiBasedRenameFilePrompt = useTvShowPromptsStore((state) => state.closeAiBasedRenameFilePrompt)
  const closeAiBasedRecognizePrompt = useTvShowPromptsStore((state) => state.closeAiBasedRecognizePrompt)
  const updateAiBasedRenameFileStatus = useTvShowPromptsStore((state) => state.updateAiBasedRenameFileStatus)

  const aiBasedRenameFilePrompt = useTvShowPromptsStore((state) => state.aiBasedRenameFilePrompt)
  const ruleBasedRenameFilePrompt = useTvShowPromptsStore((state) => state.ruleBasedRenameFilePrompt)
  const aiBasedRecognizePrompt = useTvShowPromptsStore((state) => state.aiBasedRecognizePrompt)
  const ruleBasedRecognizePrompt = useTvShowPromptsStore((state) => state.ruleBasedRecognizePrompt)

  const handleSelectResult = useCallback(async (result: TMDBTVShow | TMDBMovie, searchLanguage: 'zh-CN' | 'en-US' | 'ja-JP') => {
    console.log('[TvShowPanel] handleSelectResult CALLED', {
      timestamp: new Date().toISOString(),
      result,
      searchLanguage,
      stackTrace: new Error().stack
    })

    if (mediaMetadata?.tmdbTvShow?.id === result.id 
      && mediaMetadata?.tmdbTvShow?.name === (result as TMDBTVShow).name) {
      return
    }

    if (!mediaMetadata?.mediaFolderPath) {
      console.error("No media metadata path available")
      return
    }

    const traceId = `tmdb-tvshow-overview-handleSelectResult-${nextTraceId()}`
    updateMediaMetadata(mediaMetadata.mediaFolderPath, {
      ...mediaMetadata,
      status: 'updating',
    }, { traceId })

    try {
      const response = await getTvShowById(result.id, searchLanguage)

      if (response.error) {
        console.error("Failed to get TV show details:", response.error)
        updateMediaMetadata(mediaMetadata.mediaFolderPath, {
          ...mediaMetadata,
          status: 'ok',
        }, { traceId })
        return
      }

      if (!response.data) {
        console.error("No TV show data returned")
        updateMediaMetadata(mediaMetadata.mediaFolderPath, {
          ...mediaMetadata,
          status: 'ok',
        }, { traceId })
        return
      }

      console.log('[TvShowPanel] handleSelectResult SUCCESS', {
        timestamp: new Date().toISOString(),
        response,
        stackTrace: new Error().stack
      })

      updateMediaMetadata(mediaMetadata.mediaFolderPath, {
        ...mediaMetadata,
        tmdbTvShow: response.data,
        tmdbMediaType: 'tv',
        type: 'tvshow-folder',
        status: 'ok',
      }, { traceId })
    } catch (error) {
      console.error("Failed to update media metadata:", error)
      updateMediaMetadata(mediaMetadata.mediaFolderPath, {
        ...mediaMetadata,
        status: 'ok',
      }, { traceId })
    }
  }, [mediaMetadata, userConfig, updateMediaMetadata])

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
    const lang = mapSearchLanguageToTmdb((userConfig?.applicationLanguage || "zh-CN") as SupportedLanguage)
    handleSelectResult(tmdbTvShow, lang)
  }, [handleSelectResult, userConfig?.applicationLanguage])

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
    const lang = mapSearchLanguageToTmdb((userConfig?.applicationLanguage || "zh-CN") as SupportedLanguage)
    handleSelectResult(tmdbTvShow, lang)
  }, [handleSelectResult, userConfig?.applicationLanguage])

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
    seasons,
    setSeasons,
    selectedNamingRule,
    setSelectedNamingRule,
    setIsRenaming,
    scrollToEpisodeId,
    setScrollToEpisodeId,
  } = useTvShowPanelState({ 
    mediaMetadata, 
    toolbarOptions, 
    usePrompts: { 
      openUseNfoPrompt: openUseNfoPromptWithCallbacks
    } 
  })

  const [seasonsForPreview, setSeasonsForPreview] = useState<SeasonModel[]>([])
  /** Episode row ids (SxxEyy) selected for rename when prompt is open. Only checked rows are renamed on confirm. */
  const [renameSelection, setRenameSelection] = useState<Set<string>>(new Set())
  /** Ref so confirm handler (stored by prompt when opened) always reads latest selection instead of stale closure. */
  const renameSelectionRef = useRef<Set<string>>(renameSelection)
  renameSelectionRef.current = renameSelection

  /** Path for which `seasons` state was last set. Table only shows data when current path matches this (avoids showing previous folder's data when switching). */
  const seasonsPathRef = useRef<string | undefined>(undefined)

  const tmdbPromptStore = useTmdbIdFromFolderNamePromptStore()

  const handleTmdbIdDetected = useCallback(async (tmdbId: number, language: 'zh-CN' | 'en-US' | 'ja-JP') => {
    tmdbPromptStore.openPrompt({
      tmdbId,
      mediaName: undefined,
      status: "loading",
      onConfirm: handleUseTmdbidFromFolderNameConfirm,
      onCancel: () => {},
    })

    try {
      const response = await getTvShowById(tmdbId, language)
      
      if (response.data && !response.error) {
        tmdbPromptStore.openPrompt({
          tmdbId,
          mediaName: response.data.name,
          status: "ready",
          onConfirm: handleUseTmdbidFromFolderNameConfirm,
          onCancel: () => {},
        })
      } else {
        tmdbPromptStore.openPrompt({
          tmdbId,
          mediaName: undefined,
          status: "error",
          onConfirm: handleUseTmdbidFromFolderNameConfirm,
          onCancel: () => {},
        })
        toast.error(t('toolbar.queryTmdbFailed'))
      }
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
  }, [handleUseTmdbidFromFolderNameConfirm, t])

  useEffect(() => {
    const detection = startToRecognizeByTmdbIdInFolderName(mediaMetadata, userConfig)
    if (detection) {
      handleTmdbIdDetected(detection.tmdbId, detection.language)
    }
  }, [mediaMetadata, userConfig, handleTmdbIdDetected])

  const handleAiRecognizeConfirmCallback = useCallback(async (plan: RecognizeMediaFilePlan) => {
    if (!mediaMetadata) return
    await handleAiRecognizeConfirm(plan, mediaMetadata, updateMediaMetadata, updatePlan)
  }, [mediaMetadata, updateMediaMetadata, updatePlan])

  const handlePendingPlansChange = useCallback(() => {
    handlePendingPlans({
      pendingPlans,
      mediaMetadata,
      setSeasonsForPreview,
      openRuleBasedRecognizePrompt,
      openAiBasedRecognizePrompt,
      closeAiBasedRecognizePrompt,
      handleAiRecognizeConfirmCallback,
      updatePlan,
      updateMediaMetadata,
      t,
      buildSeasonsByRecognizeMediaFilePlan,
      recognizeEpisodes,
      toast,
    })
  }, [pendingPlans, mediaMetadata, setSeasonsForPreview, openRuleBasedRecognizePrompt, openAiBasedRecognizePrompt, closeAiBasedRecognizePrompt, handleAiRecognizeConfirmCallback, updatePlan, updateMediaMetadata, t])

  // When panel shows a media folder, fetch pending plans so we can open the right prompt (rename or recognize)
  useEffect(() => {
    if (mediaMetadata?.mediaFolderPath) {
      void fetchPendingPlans()
    }
  }, [mediaMetadata?.mediaFolderPath, fetchPendingPlans])

  useEffect(() => {
    handlePendingPlansChange()
  }, [handlePendingPlansChange])

  // Use renaming hook (used for both legacy rename and rename-plan V2 confirm)
  const { startToRenameFiles } = useTvShowRenaming({
    seasons,
    mediaMetadata,
    refreshMediaMetadata,
    setIsRenaming,
  })

  const handleRenamePlanConfirm = useCallback(
    async (plan: RenameFilesPlan) => {
      const selection = renameSelectionRef.current
      console.log("[TvShowPanel] handleRenamePlanConfirm called, renameSelection.size:", selection.size, "ids:", [...selection].sort())
      if (!mediaMetadata) {
        return
      }
      if (selection.size === 0) {
        console.log("[TvShowPanel] handleRenamePlanConfirm: selection empty, showing toast")
        toast.info(t('tvShowEpisodeTable.noFilesSelectedForRename', { defaultValue: 'No files selected for rename' }))
        return
      }
      await executeRenamePlan(plan, mediaMetadata, updateMediaMetadata as any, updatePlan, fetchPendingPlans, refreshMediaMetadata, selection)
    },
    [mediaMetadata, updateMediaMetadata, updatePlan, fetchPendingPlans, refreshMediaMetadata, t]
  )

  useEffect(() => {
    if (!mediaMetadata?.mediaFolderPath) return
    const plan = pendingRenamePlans.find(
      (p) =>
        p.task === "rename-files" &&
        p.status === "pending" &&
        mediaFolderPathEqual(p.mediaFolderPath, mediaMetadata.mediaFolderPath)
    )
    if (plan) {
      const seasonsPreview = buildSeasonsByRenameFilesPlan(mediaMetadata, plan)
      setSeasonsForPreview(seasonsPreview)
      setEpisodeTableLayout('simple')
      openAiBasedRenameFilePrompt({
        status: "wait-for-ack",
        onConfirm: () => handleRenamePlanConfirm(plan),
        onCancel: async () => {
          try {
            await updatePlan(plan.id, "rejected")
          } catch (error) {
            console.error("[TvShowPanel] Error rejecting rename plan:", error)
          }
        },
      })
    } else {
      closeAiBasedRenameFilePrompt()
      // Do not close recognize prompt here; handlePendingPlans manages AiBasedRecognizePrompt.
    }
  }, [pendingRenamePlans, mediaMetadata, openAiBasedRenameFilePrompt, closeAiBasedRenameFilePrompt, handleRenamePlanConfirm, updatePlan])

  // Use WebSocket events hook
  useTvShowWebSocketEvents({
    mediaMetadata,
    setSeasons,
    setScrollToEpisodeId,
    setSelectedMediaMetadataByMediaFolderPath: setSelectedByMediaFolderPath,
    openAiBasedRenameFilePrompt,
    setAiBasedRenameFileStatus: updateAiBasedRenameFileStatus,
  })

  // Use file name generation hook
  useTvShowFileNameGeneration({
    seasons,
    setSeasons,
    mediaMetadata,
    selectedNamingRule,
  })

  // Handle file selection for episode
  const handleEpisodeFileSelect = useCallback((episode: TMDBEpisode, file: { path: string; isDirectory?: boolean }) => {
    // Don't allow selecting directories
    if (file.isDirectory) {
      toast.error("Directory selection is not allowed. Please select a file.")
      return
    }

    // Validate mediaMetadata is available
    if (!mediaMetadata) {
      toast.error("No media metadata available")
      return
    }

    // Validate files array is available
    if (!mediaMetadata.files) {
      toast.error("Files list is not available")
      return
    }

    // Validate episode has season and episode numbers
    if (episode.season_number === undefined || episode.episode_number === undefined) {
      toast.error("Invalid episode: season or episode number is missing")
      return
    }

    // Convert file path to POSIX format
    const filePathInPosix = Path.posix(file.path)

    // Validate the file exists in the media folder files
    if (!mediaMetadata.files.includes(filePathInPosix)) {
      toast.error("Selected file is not in the media folder")
      return
    }

    // Validate mediaFolderPath is available
    if (!mediaMetadata.mediaFolderPath) {
      toast.error("Media folder path is not available")
      return
    }

    // Update media file metadata
    const updatedMediaFiles = updateMediaFileMetadatas(
      mediaMetadata.mediaFiles ?? [],
      filePathInPosix,
      episode.season_number,
      episode.episode_number
    )

    // Update media metadata
    const traceId = `TvShowPanel-handleFileSelect-${nextTraceId()}`
    updateMediaMetadata(mediaMetadata.mediaFolderPath, {
      ...mediaMetadata,
      mediaFiles: updatedMediaFiles
    }, { traceId })

    toast.success("File added successfully")
  }, [mediaMetadata, updateMediaMetadata])

  // Handle opening file picker for episode
  const handleOpenFilePickerForEpisode = useCallback((episode: TMDBEpisode) => {

    // Validate mediaMetadata is available
    if (!mediaMetadata?.mediaFolderPath) {
      toast.error("No media metadata available")
      return
    }

    // Convert media folder path from POSIX to platform-specific format for the file picker
    const mediaFolderPlatformPath = Path.toPlatformPath(mediaMetadata.mediaFolderPath)

    if (isElectron) {
      // Use native file dialog in Electron environment
      const electron = (window as any).electron
      if (electron?.dialog?.showOpenDialog) {
        electron.dialog.showOpenDialog({
          properties: ['openFile'],
          title: "Select Video File",
          defaultPath: mediaFolderPlatformPath,
          filters: [
            { name: 'Video Files', extensions: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'ts'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        }).then((result: any) => {
          if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
            const selectedFile = {
              path: result.filePaths[0],
              isDirectory: false
            }
            handleEpisodeFileSelect(episode, selectedFile)
          }
        }).catch((error: Error) => {
          console.error('[handleOpenFilePickerForEpisode] Error opening native dialog:', error)
          toast.error(`Failed to open file dialog: ${error.message}`)
        })
      } else {
        toast.error("Native dialog not available")
      }
    } else {
      // Use custom file picker dialog in web environment
      const fileSelectHandler = (selectedFile: { path: string; isDirectory?: boolean }) => {
        handleEpisodeFileSelect(episode, selectedFile)
      }

      openFilePicker(fileSelectHandler, {
        title: "Select Video File",
        description: "Choose a video file for this episode",
        selectFolder: false,
        initialPath: mediaFolderPlatformPath
      })
    }
  }, [mediaMetadata, isElectron, openFilePicker, handleEpisodeFileSelect, seasons])

  const handleRuleBasedRenameConfirm = useCallback(() => {
    const selection = renameSelectionRef.current
    console.log("[TvShowPanel] handleRuleBasedRenameConfirm called, renameSelection.size:", selection.size, "ids:", [...selection].sort())
    if (selection.size === 0) {
      console.log("[TvShowPanel] handleRuleBasedRenameConfirm: selection empty, showing toast")
      toast.info(t('tvShowEpisodeTable.noFilesSelectedForRename', { defaultValue: 'No files selected for rename' }))
      return
    }
    startToRenameFiles(undefined, selection)
  }, [startToRenameFiles, t])

  // Handler for rule-based recognition button click
  const handleRuleBasedRecognizeButtonClick = useCallback(() => {
    if (!mediaMetadata?.mediaFolderPath) {
      toast.error("No media folder path available")
      return
    }

    console.log('[TvShowPanel] recognize button clicked', {
      mediaFolderPath: mediaMetadata.mediaFolderPath,
      filesCount: mediaMetadata.files?.length,
      filesSample: mediaMetadata.files?.slice(0, 5),
      seasonsCount: mediaMetadata.tmdbTvShow?.seasons?.length,
      episodeCountsBySeason: mediaMetadata.tmdbTvShow?.seasons?.map(s => ({ season: s.season_number, episodes: s.episodes?.length })),
    })

    // 1. Add tmp plan with loading state so RuleBasedRecognizePrompt shows immediately
    const planId = addTmpPlan(
      { mediaFolderPath: mediaMetadata.mediaFolderPath, files: [] },
      { status: 'loading' }
    )

    // 2. Run recognition in background, then update plan with result
    void buildTemporaryRecognitionPlanAsync(mediaMetadata)
      .then(planData => {
        if (planData && planData.files.length > 0) {
          updateTmpPlan(planId, { status: 'pending', files: planData.files })
          console.log('[TvShowPanel] Temporary recognition plan updated with result', {
            fileCount: planData.files.length,
            mediaFolderPath: planData.mediaFolderPath,
          })
        } else {
          updateTmpPlan(planId, { status: 'rejected' })
          toast.error(t('toolbar.noRecognizedFiles', { defaultValue: 'No recognized files found' }))
        }
      })
      .catch(err => {
        updateTmpPlan(planId, { status: 'rejected' })
        toast.error(err instanceof Error ? err.message : 'Recognition failed')
      })
  }, [mediaMetadata, addTmpPlan, updateTmpPlan, t])

  const handleMediaFolderSelected = useCallback((mm: UIMediaMetadata): boolean => {
    return onMediaFolderSelected({
      mediaMetadata: mm,
      openRuleBasedRecognizePrompt,
      updateMediaMetadata,
      buildSeasonsModelFromMediaMetadata,
      setSeasons,
    })
  }, [openRuleBasedRecognizePrompt, updateMediaMetadata, setSeasons])

  useEffect(() => {
    if (!mediaMetadata) {
      console.log("[TvShowPanel] handleMediaFolderSelected effect: no mediaMetadata, skip")
      return
    }
    const path = mediaMetadata.mediaFolderPath
    console.log("[TvShowPanel] handleMediaFolderSelected effect run", {
      mediaFolderPath: path,
      status: mediaMetadata.status,
    })
    setSeasonsForPreview([])
    const didSetSeasons = handleMediaFolderSelected(mediaMetadata)
    // Only tie ref to this path when seasons were actually set (avoids showing previous folder's data
    // when status is 'ok' but buildSeasonsModelFromMediaMetadata returns null, or when status !== 'ok').
    if (didSetSeasons && path !== undefined) {
      seasonsPathRef.current = path
    }
  }, [mediaMetadata, mediaMetadata?.mediaFolderPath, mediaMetadata?.status, handleMediaFolderSelected])

  useEffect(() => {
    if (!mediaMetadata) {
      return
    }

    // Recognize only when the RuleBasedRecognizePrompt is opened
    if(!ruleBasedRecognizePrompt.isOpen) {
      return
    }

    let cancelled = false
    void (async () => {
      const updatedSeasons = await recognizeMediaFilesByRulesAsync(mediaMetadata)
      if (!cancelled && updatedSeasons !== null) {
        setSeasonsForPreview(updatedSeasons)
        console.log(`[TvShowPanel] set the seasonsForPreview state`)
      }
    })()
    return () => { cancelled = true }
  }, [mediaMetadata, ruleBasedRecognizePrompt.isOpen])

  const effectiveSeasons = useMemo(
    () =>
      ruleBasedRecognizePrompt.isOpen || aiBasedRenameFilePrompt.isOpen || aiBasedRecognizePrompt.isOpen
        ? seasonsForPreview
        : seasons,
    [ruleBasedRecognizePrompt.isOpen, aiBasedRenameFilePrompt.isOpen, aiBasedRecognizePrompt.isOpen, seasonsForPreview, seasons]
  )

  // When rename prompt *just* opened, or when prompt is open and effectiveSeasons first gets episodes with renames (e.g. file name generation ran), set initial selection. Do NOT overwrite when user has already changed selection (ref.size > 0).
  const renamePromptWasOpenRef = useRef(false)
  useEffect(() => {
    const promptOpen = ruleBasedRenameFilePrompt.isOpen || aiBasedRenameFilePrompt.isOpen
    const justOpened = promptOpen && !renamePromptWasOpenRef.current
    renamePromptWasOpenRef.current = promptOpen

    if (!promptOpen) return

    const initial = new Set<string>()
    for (const seasonModel of effectiveSeasons) {
      const seasonNo = seasonModel.season.season_number
      for (const episodeModel of seasonModel.episodes) {
        const episodeNo = episodeModel.episode.episode_number
        const videoFile = episodeModel.files.find((f) => f.type === "video")
        if (videoFile?.newPath && videoFile.path !== videoFile.newPath) {
          const episodeId = `S${String(seasonNo).padStart(2, "0")}E${String(episodeNo).padStart(2, "0")}`
          initial.add(episodeId)
        }
      }
    }
    const shouldSet = justOpened || (initial.size > 0 && renameSelectionRef.current.size === 0)
    if (!shouldSet) return
    console.log("[TvShowPanel] renameSelection init effect: justOpened:", justOpened, "effectiveSeasons length:", effectiveSeasons.length, "initial selection size:", initial.size, "ids:", [...initial].sort())
    setRenameSelection(initial)
  }, [ruleBasedRenameFilePrompt.isOpen, aiBasedRenameFilePrompt.isOpen, effectiveSeasons])

  const episodeTableData = useMemo<TvShowEpisodeTableRow[]>(() => {
    const rows: TvShowEpisodeTableRow[] = []

    if (mediaMetadata?.files && mediaMetadata.mediaFolderPath) {
      rows.push(...buildFolderFileRows(mediaMetadata.files))
    }

    for (const seasonModel of effectiveSeasons) {
      const seasonNo = seasonModel.season.season_number
      const seasonText = seasonModel.season.name || `Season ${seasonNo}`
      rows.push({
        id: `season-${seasonNo}`,
        type: "divider",
        text: seasonText,
      })

      for (const episodeModel of seasonModel.episodes) {
        const episodeNo = episodeModel.episode.episode_number
        const episodeId = `S${String(seasonNo).padStart(2, "0")}E${String(episodeNo).padStart(2, "0")}`
        const videoFile = episodeModel.files.find((file) => file.type === "video")
        const thumbnailFile = episodeModel.files.find((file) => file.type === "poster")
        const subtitleFile = episodeModel.files.find((file) => file.type === "subtitle")
        const nfoFile = episodeModel.files.find((file) => file.type === "nfo")
        rows.push({
          id: episodeId,
          type: "episode",
          videoFile: videoFile?.path,
          thumbnail: thumbnailFile?.path,
          subtitle: subtitleFile?.path,
          nfo: nfoFile?.path,
          episodeTitle: episodeModel.episode.name ?? "",
          newVideoFile: videoFile?.newPath,
          newThumbnail: thumbnailFile?.newPath,
          newSubtitle: subtitleFile?.newPath,
          newNfo: nfoFile?.newPath,
        })
      }
    }

    console.log("[TvShowPanel] episodeTableData useMemo", {
      mediaFolderPath: mediaMetadata?.mediaFolderPath,
      effectiveSeasonsLength: effectiveSeasons.length,
      rowsLength: rows.length,
    })
    return rows
  }, [effectiveSeasons, mediaMetadata?.files, mediaMetadata?.mediaFolderPath])

  const currentPath = mediaMetadata?.mediaFolderPath
  const tableData =
    currentPath !== undefined && currentPath === seasonsPathRef.current
      ? episodeTableData
      : []

  const handleVideoFileSelectForRow = useCallback(
    (rowId: string) => {
      const match = rowId.match(/^S(\d+)E(\d+)$/)
      if (!match) return
      const seasonNo = parseInt(match[1], 10)
      const episodeNo = parseInt(match[2], 10)
      const seasonModel = effectiveSeasons.find((s) => s.season.season_number === seasonNo)
      const episodeModel = seasonModel?.episodes.find((e) => e.episode.episode_number === episodeNo)
      if (episodeModel) {
        handleOpenFilePickerForEpisode(episodeModel.episode)
      }
    },
    [effectiveSeasons, handleOpenFilePickerForEpisode]
  )

  const handleUnlinkEpisode = useCallback(
    (rowId: string) => {
      unlinkEpisode({
        rowId,
        mediaMetadata,
        updateMediaMetadata,
        t: t as (key: string, options?: Record<string, unknown>) => string,
      })
    },
    [mediaMetadata, updateMediaMetadata, t]
  )

  const handleEditTagsForRow = useCallback(
    (rowId: string) => {
      const match = rowId.match(/^S(\d+)E(\d+)$/)
      if (!match) return
      const seasonNo = parseInt(match[1], 10)
      const episodeNo = parseInt(match[2], 10)
      const seasonModel = effectiveSeasons.find((s) => s.season.season_number === seasonNo)
      const episodeModel = seasonModel?.episodes.find((e) => e.episode.episode_number === episodeNo)
      const videoFile = episodeModel?.files.find((f) => f.type === "video")
      const videoPath = videoFile?.path
      if (videoPath) {
        openEditMediaFile({ path: videoPath })
      }
    },
    [effectiveSeasons, openEditMediaFile]
  )

  const backdropUrl = getTMDBImageUrl(mediaMetadata?.tmdbTvShow?.backdrop_path, 'w780');

  return (
    <div className='w-full h-full min-h-0 relative flex flex-col'>
      <TvShowPanelPrompts />

      {v2 && (
        <>
          <div className="shrink-0 px-4 pt-4">
            <TvShowHeaderV2
              onSearchResultSelected={handleSelectResult}
              onRecognizeButtonClick={handleRuleBasedRecognizeButtonClick}
              onRenameClick={() => {
        setEpisodeTableLayout('simple')
        openRuleBasedRenameFilePrompt({
          toolbarOptions,
          selectedNamingRule,
          setSelectedNamingRule,
          onConfirm: handleRuleBasedRenameConfirm,
          onCancel: () => {},
        })
      }}
              selectedMediaMetadata={mediaMetadata}
              openScrape={openScrape}
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
                onVideoFileSelect={handleVideoFileSelectForRow}
                onUnlinkEpisode={handleUnlinkEpisode}
                onEditTags={handleEditTagsForRow}
                preview={aiBasedRenameFilePrompt.isOpen || ruleBasedRenameFilePrompt.isOpen}
                layout={episodeTableLayout}
                renameSelection={renameSelection}
                onRenameSelectionChange={setRenameSelection}
              />
            )}
          </div>
        </>
      )}
      {!v2 && (
      <div className="relative w-full overflow-hidden flex flex-col">
        {backdropUrl && (
          <div 
            className="absolute inset-0 bg-cover bg-center opacity-20 dark:opacity-10"
            style={{ backgroundImage: `url(${backdropUrl})` }}
          />
        )}
        <div className="relative p-6 flex-1 overflow-y-auto space-y-6">
          <TVShowHeader
            onSearchResultSelected={handleSelectResult}
            onRecognizeButtonClick={handleRuleBasedRecognizeButtonClick}
            onRenameClick={() => openRuleBasedRenameFilePrompt({
              toolbarOptions,
              selectedNamingRule,
              setSelectedNamingRule,
              onConfirm: handleRuleBasedRenameConfirm,
              onCancel: () => {},
            })}
            selectedMediaMetadata={mediaMetadata}
            openScrape={openScrape}
          />

          <SeasonSection
            selectedMediaMetadata={mediaMetadata}
            seasons={effectiveSeasons}
            scrollToEpisodeId={scrollToEpisodeId}
            onEpisodeFileSelect={handleOpenFilePickerForEpisode}
          />

          
        </div>
      </div>
      )}
      
    </div>
  )
}

export default TvShowPanel
