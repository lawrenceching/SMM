import { TVShowHeader } from "./tv-show-header"
import { SeasonSection } from "./season-section"
import { useMediaMetadata } from "@/providers/media-metadata-provider"
import { useState, useEffect, useCallback, useRef } from "react"
import type { TMDBEpisode, TMDBTVShow, TMDBMovie } from "@core/types"
import type { FileProps } from "@/lib/types"
import { nextTraceId } from "@/lib/utils"
import { useLatest } from "react-use"
import { toast } from "sonner"
import { sendAcknowledgement } from "@/hooks/useWebSocket"
import type {
  AskForRenameFilesConfirmationResponseData,
} from "@core/event-types"
import { useTranslation } from "@/lib/i18n"
import { lookup } from "@/lib/lookup"
import { recognizeEpisodes, updateMediaFileMetadatas, buildSeasonsByRecognizeMediaFilePlan, buildSeasonsByRenameFilesPlan, executeRenamePlan, buildTemporaryRecognitionPlan, recognizeMediaFilesByRules, buildSeasonsModelFromMediaMetadata, handleAiRecognizeConfirm, handlePendingPlans } from "./TvShowPanelUtils"
import { TvShowPanelPrompts, TvShowPanelPromptsProvider, usePrompts, usePromptsContext } from "./TvShowPanelPrompts"
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
import { extractUIMediaMetadataProps, type UIMediaMetadata } from "@/types/UIMediaMetadata"
import { recognizeMediaFolder } from "@/lib/recognizeMediaFolder"
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

function TvShowPanelContent() {
  const { t } = useTranslation(['components', 'errors'])
  const { pendingPlans, pendingRenamePlans, updatePlan, fetchPendingPlans, addTmpPlan } = usePlansStore()
  const { 
    selectedMediaMetadata: mediaMetadata, 
    updateMediaMetadata,
    refreshMediaMetadata, setSelectedMediaMetadataByMediaFolderPath
   } = useMediaMetadata()
  const { filePickerDialog, scrapeDialog } = useDialogs()
  const [openFilePicker] = filePickerDialog
  const [openScrape] = scrapeDialog
  const { userConfig } = useConfig()
  const toolbarOptions: ToolbarOption[] = [
    { value: "plex", label: t('toolbar.plex') } as ToolbarOption,
    { value: "emby", label: t('toolbar.emby') } as ToolbarOption,
  ]

  // Use prompts hook
  const { openUseNfoPrompt, openRuleBasedRenameFilePrompt, openRuleBasedRecognizePrompt, openAiBasedRenameFilePrompt, openAiRecognizePrompt } = usePrompts()

  const [isUpdatingTvShow, setIsUpdatingTvShow] = useState(false)

  // Expansion state
  const [expandedSeasonIds, setExpandedSeasonIds] = useState<Set<number>>(new Set())
  const [expandedEpisodeIds, setExpandedEpisodeIds] = useState<Set<number>>(new Set())

  const handleSelectResult = useCallback(async (result: TMDBTVShow | TMDBMovie) => {
    if (mediaMetadata?.tmdbTvShow?.id === result.id) {
      return
    }

    if (!mediaMetadata?.mediaFolderPath) {
      console.error("No media metadata path available")
      return
    }

    setIsUpdatingTvShow(true)

    try {
      const language = (userConfig?.applicationLanguage || 'en-US') as 'zh-CN' | 'en-US' | 'ja-JP'
      const response = await getTvShowById(result.id, language)

      if (response.error) {
        console.error("Failed to get TV show details:", response.error)
        setIsUpdatingTvShow(false)
        return
      }

      if (!response.data) {
        console.error("No TV show data returned")
        setIsUpdatingTvShow(false)
        return
      }

      const traceId = `tmdb-tvshow-overview-handleSelectResult-${nextTraceId()}`
      updateMediaMetadata(mediaMetadata.mediaFolderPath, {
        ...mediaMetadata,
        tmdbTvShow: response.data,
        tmdbMediaType: 'tv',
        type: 'tvshow-folder',
      }, { traceId })

      setIsUpdatingTvShow(false)
    } catch (error) {
      console.error("Failed to update media metadata:", error)
      setIsUpdatingTvShow(false)
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

  const latestSeasons = useLatest(seasons)
  const [seasonsForPreview, setSeasonsForPreview] = useState<SeasonModel[]>([])

  /**
   * The message from socket.io, which will be used to send acknowledgement later when user confirms or cancels
   */
  const [pendingConfirmationMessage] = useState<any>(null)

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

  // Get prompts context for closing prompts
  const promptsContextForClosing = usePromptsContext()

  // Wrapper for closing prompts
  const closeAiBasedRenameFilePrompt = useCallback(() => {
    promptsContextForClosing._setIsAiBasedRenameFilePromptOpen(false)
  }, [promptsContextForClosing])

  const closeAiRecognizePrompt = useCallback(() => {
    promptsContextForClosing._setIsAiRecognizePromptOpen(false)
  }, [promptsContextForClosing])

  const handlePendingPlansChange = useCallback(() => {
    handlePendingPlans({
      pendingPlans,
      mediaMetadata,
      setSeasonsForPreview,
      openRuleBasedRecognizePrompt,
      openAiRecognizePrompt,
      closeAiRecognizePrompt,
      handleAiRecognizeConfirmCallback,
      updatePlan,
      updateMediaMetadata,
      t,
      buildSeasonsByRecognizeMediaFilePlan,
      recognizeEpisodes,
      toast,
    })
  }, [pendingPlans, mediaMetadata, setSeasonsForPreview, openRuleBasedRecognizePrompt, openAiRecognizePrompt, closeAiRecognizePrompt, handleAiRecognizeConfirmCallback, updatePlan, updateMediaMetadata, t])

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
      closeAiRecognizePrompt()
    }
  }, [pendingRenamePlans, mediaMetadata, openAiBasedRenameFilePrompt, handleRenamePlanConfirm, updatePlan, closeAiBasedRenameFilePrompt, closeAiRecognizePrompt, promptsContextForClosing])

  // Handle confirm button click - rename all files
  const handleAiBasedRenamePromptConfirm = useCallback(async () => {
    console.log('[TvShowPanel] handleAiBasedRenamePromptConfirm CALLED', {
      timestamp: new Date().toISOString(),
      hasPendingConfirmationMessage: !!pendingConfirmationMessage,
      mediaFolderPath: mediaMetadata?.mediaFolderPath,
      stackTrace: new Error().stack
    })
    // Send acknowledgement if there's a pending confirmation message
    if (pendingConfirmationMessage) {
      const respData: AskForRenameFilesConfirmationResponseData = {
        confirmed: true,
      }
      sendAcknowledgement(pendingConfirmationMessage, respData);
      return;
    }

    if (!mediaMetadata?.mediaFolderPath) {
      toast.error("No media folder path available")
      return
    }

    try {
      await startToRenameFiles();
    } catch (error) {
      console.error('Error starting to rename files', error);
    }
    
  }, [mediaMetadata, latestSeasons, refreshMediaMetadata, pendingConfirmationMessage, startToRenameFiles])

  // Wrapper for openAiBasedRenameFilePrompt that handles status updates and callbacks
  // TODO: do I still need this wrapper?
  const openAiBasedRenameFilePromptWithStatus = useCallback((params: {
    status: "generating" | "wait-for-ack"
    onConfirm: () => void
    onCancel?: () => void
  }) => {
    openAiBasedRenameFilePrompt({
      status: params.status,
      onConfirm: handleAiBasedRenamePromptConfirm,
      onCancel: params.onCancel,
    })
  }, [openAiBasedRenameFilePrompt, handleAiBasedRenamePromptConfirm])

  // Get prompts context for status updates (only get the setter, not the whole context)
  const promptsContext = usePromptsContext()
  const setAiBasedRenameFileStatusFromContext = promptsContext._setAiBasedRenameFileStatus

  // Wrapper for setAiBasedRenameFileStatus that updates context
  const setAiBasedRenameFileStatus = useCallback((status: "generating" | "wait-for-ack") => {
    setAiBasedRenameFileStatusFromContext(status)
  }, [setAiBasedRenameFileStatusFromContext])

  // Use WebSocket events hook
  useTvShowWebSocketEvents({
    mediaMetadata,
    setSeasons,
    setScrollToEpisodeId,
    setSelectedMediaMetadataByMediaFolderPath,
    openAiBasedRenameFilePrompt: openAiBasedRenameFilePromptWithStatus,
    setAiBasedRenameFileStatus,
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

    if(mm.mediaFolderPath === undefined) {
      console.error('[TvShowPanel] handleMediaFolderSelected: media folder path is undefined')
      return;
    }

    if(mm.status !== 'ok') {
      return;
    }

    // try recognizing media folder
    (async () => {

      if(mm.type === undefined || (mm.tmdbTvShow === undefined && mm.tmdbMovie === undefined)) {
        
        const recognized: UIMediaMetadata | undefined = await recognizeMediaFolder(mm)
        if(recognized !== undefined) {
          openRuleBasedRecognizePrompt({
            onConfirm: () => {
              updateMediaMetadata(mm.mediaFolderPath!, (prev: UIMediaMetadata) => {
                return {
                  ...prev,
                  ...recognized,
                  ...extractUIMediaMetadataProps(prev),
                }
              })
            },
            onCancel: () => {},
          })
        }
        
      }

    })()
    
    // build season model
    const seasons = buildSeasonsModelFromMediaMetadata(mm)
    if(seasons !== null) {
      setSeasons(seasons)
    }
  }, [])

  useEffect(() => {
    if (!mediaMetadata) {
      return
    }
    handleMediaFolderSelected(mediaMetadata)
  }, [mediaMetadata])

  // Get prompt states for preview mode calculation (promptsContext already declared above)
  const isPreviewingForRename = promptsContext.isAiBasedRenameFilePromptOpen 
      || promptsContext.isRuleBasedRenameFilePromptOpen 
      || promptsContext.isRuleBasedRecognizePromptOpen
      || promptsContext.isAiRecognizePromptOpen

  /** True when user is reviewing match between local video file and episode; UI should highlight the video file path. */
  const isPreviewingForRecognize = promptsContext.isRuleBasedRecognizePromptOpen || promptsContext.isAiRecognizePromptOpen

  // Preview mode effect - expand all seasons/episodes when entering preview mode
  const savedSeasonIdsRef = useRef<Set<number> | null>(null)
  const savedEpisodeIdsRef = useRef<Set<number> | null>(null)
  const prevPreviewModeRef = useRef(false)

  useEffect(() => {
    const wasInPreviewMode = prevPreviewModeRef.current
    prevPreviewModeRef.current = isPreviewingForRename

    if (isPreviewingForRename && !wasInPreviewMode && mediaMetadata?.tmdbTvShow?.seasons) {
      setExpandedSeasonIds(currentSeasonIds => {
        savedSeasonIdsRef.current = new Set(currentSeasonIds)
        const seasonIds = new Set(mediaMetadata.tmdbTvShow!.seasons!.map(season => season.id))
        return seasonIds
      })

      setExpandedEpisodeIds(currentEpisodeIds => {
        savedEpisodeIdsRef.current = new Set(currentEpisodeIds)
        const episodeIds = new Set<number>()
        mediaMetadata.tmdbTvShow!.seasons!.forEach(season => {
          if (season.episodes) {
            season.episodes.forEach(episode => {
              episodeIds.add(episode.id)
            })
          }
        })
        return episodeIds
      })
    } else if (!isPreviewingForRename && wasInPreviewMode && savedSeasonIdsRef.current !== null && savedEpisodeIdsRef.current !== null) {
      setExpandedSeasonIds(savedSeasonIdsRef.current)
      setExpandedEpisodeIds(savedEpisodeIdsRef.current)
      savedSeasonIdsRef.current = null
      savedEpisodeIdsRef.current = null
    }
  }, [isPreviewingForRename, mediaMetadata?.tmdbTvShow?.seasons])

  // Handle scrolling to episode when scrollToEpisodeId changes
  useEffect(() => {
    if (scrollToEpisodeId === null || scrollToEpisodeId === undefined || !mediaMetadata?.tmdbTvShow?.seasons) {
      return
    }

    let targetSeasonId: number | null = null
    for (const season of mediaMetadata.tmdbTvShow.seasons) {
      if (season.episodes) {
        const episode = season.episodes.find(ep => ep.id === scrollToEpisodeId)
        if (episode) {
          targetSeasonId = season.id
          break
        }
      }
    }

    if (targetSeasonId === null) {
      console.warn(`[TvShowPanel] Episode with ID ${scrollToEpisodeId} not found`)
      return
    }

    setExpandedSeasonIds(prev => {
      const newSet = new Set(prev)
      newSet.add(targetSeasonId!)
      return newSet
    })

    setExpandedEpisodeIds(prev => {
      const newSet = new Set(prev)
      newSet.add(scrollToEpisodeId!)
      return newSet
    })

    const timeoutId = setTimeout(() => {
      const episodeElement = document.querySelector(`[data-episode-id="${scrollToEpisodeId}"]`)
      if (episodeElement) {
        episodeElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'nearest'
        })
      } else {
        console.warn(`[TvShowPanel] Episode element with ID ${scrollToEpisodeId} not found in DOM`)
      }
    }, 100)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [scrollToEpisodeId, mediaMetadata?.tmdbTvShow?.seasons])

  useEffect(() => {
    if (!mediaMetadata) {
      return
    }

    // Recognize only when the RuleBasedRecognizePrompt is opened
    if(!promptsContext.isRuleBasedRecognizePromptOpen) {
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
  }, [mediaMetadata, promptsContext.isRuleBasedRecognizePromptOpen])

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
            tvShow={mediaMetadata?.tmdbTvShow}
            isUpdatingTvShow={isUpdatingTvShow}
            initialSearchValue={mediaMetadata?.tmdbTvShow?.name}
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
            tvShow={mediaMetadata?.tmdbTvShow}
            isUpdatingTvShow={isUpdatingTvShow || (mediaMetadata?.status === 'initializing')}
            expandedSeasonIds={expandedSeasonIds}
            setExpandedSeasonIds={setExpandedSeasonIds}
            expandedEpisodeIds={expandedEpisodeIds}
            setExpandedEpisodeIds={setExpandedEpisodeIds}
            isPreviewingForRename={isPreviewingForRename}
            isPreviewingForRecognize={isPreviewingForRecognize}
            ruleName={selectedNamingRule}
            seasons={
              promptsContext.isRuleBasedRecognizePromptOpen || promptsContext.isAiBasedRenameFilePromptOpen || promptsContext.isRuleBasedRecognizePromptOpen
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

function TvShowPanel() {
  return (
    <TvShowPanelPromptsProvider>
      <TvShowPanelContent />
    </TvShowPanelPromptsProvider>
  )
}

export default TvShowPanel
