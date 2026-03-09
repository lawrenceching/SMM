import { TVShowHeader } from "./tv-show-header"
import { SeasonSection } from "./season-section"
import { useMediaMetadataStoreState, useMediaMetadataStoreActions } from "@/stores/mediaMetadataStore"
import { useMediaMetadataActions } from "@/actions/mediaMetadataActions"
import { useState, useEffect, useCallback } from "react"
import type { TMDBEpisode, TMDBTVShow, TMDBMovie } from "@core/types"
import type { FileProps } from "@/lib/types"
import { nextTraceId } from "@/lib/utils"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"
import { lookup } from "@/lib/lookup"
import { recognizeEpisodes, updateMediaFileMetadatas, buildSeasonsByRecognizeMediaFilePlan, buildSeasonsByRenameFilesPlan, executeRenamePlan, buildTemporaryRecognitionPlan, recognizeMediaFilesByRules, buildSeasonsModelFromMediaMetadata, handleAiRecognizeConfirm, handlePendingPlans, onMediaFolderSelected } from "./TvShowPanelUtils"
import { TvShowPanelPrompts } from "./TvShowPanelPrompts"
import { useTvShowPromptsStore } from "@/stores/tvShowPromptsStore"
import { useTvShowPanelState } from "./hooks/useTvShowPanelState"
import { useTvShowFileNameGeneration } from "./hooks/useTvShowFileNameGeneration"
import { useTvShowRenaming } from "./hooks/useTvShowRenaming"
import { useTvShowWebSocketEvents } from "./hooks/useTvShowWebSocketEvents"
import { getTvShowById, getTMDBImageUrl } from "@/api/tmdb"
import { useConfig } from "@/providers/config-provider"
import { useDialogs } from "@/providers/dialog-provider"
import { Path } from "@core/path"
import { usePlansStore } from "@/stores/plansStore"
import type { RecognizeMediaFilePlan } from "@core/types/RecognizeMediaFilePlan"
import type { RenameFilesPlan } from "@core/types/RenameFilesPlan"
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"
import { useTmdbIdFromFolderNamePromptStore } from "@/stores/useTmdbIdFromFolderNamePromptStore"
import { startToRecognizeByTmdbIdInFolderName } from "./hooks/startToRecognizeByTmdbIdInFolderName"

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

function TvShowPanel() {
  const { t } = useTranslation(['components', 'errors'])
  const { pendingPlans, pendingRenamePlans, updatePlan, fetchPendingPlans, addTmpPlan } = usePlansStore()
  const { selectedMediaMetadata: mediaMetadata } = useMediaMetadataStoreState()
  const { setSelectedByMediaFolderPath } = useMediaMetadataStoreActions()
  const { updateMediaMetadata, refreshMediaMetadata } = useMediaMetadataActions()
  const { filePickerDialog, scrapeDialog } = useDialogs()
  const [openFilePicker] = filePickerDialog
  const [openScrape] = scrapeDialog
  const { userConfig } = useConfig()
  const toolbarOptions: ToolbarOption[] = [
    { value: "plex", label: t('toolbar.plex') } as ToolbarOption,
    { value: "emby", label: t('toolbar.emby') } as ToolbarOption,
  ]

  const openUseNfoPrompt = useTvShowPromptsStore((state) => state.openUseNfoPrompt)
  const openRuleBasedRenameFilePrompt = useTvShowPromptsStore((state) => state.openRuleBasedRenameFilePrompt)
  const openAiBasedRenameFilePrompt = useTvShowPromptsStore((state) => state.openAiBasedRenameFilePrompt)
  const openAiBasedRecognizePrompt = useTvShowPromptsStore((state) => state.openAiBasedRecognizePrompt)
  const openRuleBasedRecognizePrompt = useTvShowPromptsStore((state) => state.openRuleBasedRecognizePrompt)
  const closeAiBasedRenameFilePrompt = useTvShowPromptsStore((state) => state.closeAiBasedRenameFilePrompt)
  const closeAiBasedRecognizePrompt = useTvShowPromptsStore((state) => state.closeAiBasedRecognizePrompt)
  const updateAiBasedRenameFileStatus = useTvShowPromptsStore((state) => state.updateAiBasedRenameFileStatus)

  const aiBasedRenameFilePrompt = useTvShowPromptsStore((state) => state.aiBasedRenameFilePrompt)
  const aiBasedRecognizePrompt = useTvShowPromptsStore((state) => state.aiBasedRecognizePrompt)
  const ruleBasedRecognizePrompt = useTvShowPromptsStore((state) => state.ruleBasedRecognizePrompt)

  const handleSelectResult = useCallback(async (result: TMDBTVShow | TMDBMovie) => {
    if (mediaMetadata?.tmdbTvShow?.id === result.id) {
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
      const language = (userConfig?.applicationLanguage || 'en-US') as 'zh-CN' | 'en-US' | 'ja-JP'
      const response = await getTvShowById(result.id, language)

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
    handleSelectResult(tmdbTvShow)
  }, [handleSelectResult])

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
    handleSelectResult(tmdbTvShow)
  }, [handleSelectResult])

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
      if (!mediaMetadata) {
        return
      }
      await executeRenamePlan(plan, mediaMetadata, updateMediaMetadata as any, updatePlan, fetchPendingPlans)
    },
    [mediaMetadata, updateMediaMetadata, updatePlan, fetchPendingPlans]
  )

  useEffect(() => {
    if (!mediaMetadata?.mediaFolderPath) return
    const plan = pendingRenamePlans.find(
      (p) =>
        p.task === "rename-files" &&
        p.status === "pending" &&
        p.mediaFolderPath === mediaMetadata.mediaFolderPath
    )
    if (plan) {
      const seasonsPreview = buildSeasonsByRenameFilesPlan(mediaMetadata, plan)
      setSeasonsForPreview(seasonsPreview)
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
      closeAiBasedRecognizePrompt()
    }
  }, [pendingRenamePlans, mediaMetadata, openAiBasedRenameFilePrompt, closeAiBasedRenameFilePrompt, closeAiBasedRecognizePrompt, handleRenamePlanConfirm, updatePlan])

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

    // Create file selection handler for this specific episode
    const fileSelectHandler = (selectedFile: { path: string; isDirectory?: boolean }) => {

      handleEpisodeFileSelect(episode, selectedFile)
    }

    openFilePicker(fileSelectHandler, {
      title: "Select Video File",
      description: "Choose a video file for this episode",
      selectFolder: false,
      initialPath: mediaFolderPlatformPath
    })
  }, [mediaMetadata, openFilePicker, handleEpisodeFileSelect, seasons])

  const handleRuleBasedRenameConfirm = useCallback(() => {
    console.log('[TvShowPanel] handleRuleBasedRenameConfirm CALLED', {
      timestamp: new Date().toISOString(),
      stackTrace: new Error().stack
    })
    startToRenameFiles()
  }, [startToRenameFiles])

  // Handler for rule-based recognition button click
  const handleRuleBasedRecognizeButtonClick = useCallback(() => {
    if (!mediaMetadata?.mediaFolderPath) {
      toast.error("No media folder path available")
      return
    }

    const planData = buildTemporaryRecognitionPlan(mediaMetadata, lookup)
    if (!planData || planData.files.length === 0) {
      toast.error("No recognized files found")
      return
    }

    // Create and add temporary plan to global state
    // addTmpPlan will set tmp flag, id, task, and status automatically
    addTmpPlan({
      mediaFolderPath: planData.mediaFolderPath,
      files: planData.files,
    })

    console.log('[TvShowPanel] Temporary recognition plan created and added to state', {
      fileCount: planData.files.length,
      mediaFolderPath: planData.mediaFolderPath
    })
  }, [mediaMetadata, addTmpPlan])

  const handleMediaFolderSelected = useCallback((mm: UIMediaMetadata) => {
    onMediaFolderSelected({
      mediaMetadata: mm,
      openRuleBasedRecognizePrompt,
      updateMediaMetadata,
      buildSeasonsModelFromMediaMetadata,
      setSeasons,
    })
  }, [openRuleBasedRecognizePrompt, updateMediaMetadata, setSeasons])

  useEffect(() => {
    if (!mediaMetadata) {
      return
    }
    handleMediaFolderSelected(mediaMetadata)
  }, [mediaMetadata, handleMediaFolderSelected])

  useEffect(() => {
    if (!mediaMetadata) {
      return
    }

    // Recognize only when the RuleBasedRecognizePrompt is opened
    if(!ruleBasedRecognizePrompt.isOpen) {
      return
    }

    const updatedSeasons = recognizeMediaFilesByRules(
      mediaMetadata,
      lookup
    )

    if (updatedSeasons !== null) {
      setSeasonsForPreview(updatedSeasons)
      console.log(`[TvShowPanel] set the seasonsForPreview state`)
    }
  }, [mediaMetadata, ruleBasedRecognizePrompt.isOpen])

  const backdropUrl = getTMDBImageUrl(mediaMetadata?.tmdbTvShow?.backdrop_path, 'w780');

  return (
    <div className='p-1 w-full h-full relative'>
      <TvShowPanelPrompts />

      
      <div className="relative w-full h-full overflow-hidden flex flex-col">
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
            seasons={
              ruleBasedRecognizePrompt.isOpen || aiBasedRenameFilePrompt.isOpen || aiBasedRecognizePrompt.isOpen
                ? seasonsForPreview
                : seasons
            }
            scrollToEpisodeId={scrollToEpisodeId}
            onEpisodeFileSelect={handleOpenFilePickerForEpisode}
          />
        </div>
      </div>
    </div>
  )
}

export default TvShowPanel
