import { isNil } from "es-toolkit"
import { TMDBTVShowOverview, type TMDBTVShowOverviewRef } from "./tmdb-tvshow-overview"
import { useMediaMetadata } from "@/providers/media-metadata-provider"
import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import type { TMDBEpisode, TMDBTVShow } from "@core/types"
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
import { recognizeEpisodes, updateMediaFileMetadatas, buildSeasonsByRecognizeMediaFilePlan, buildSeasonsByRenameFilesPlan, applyRecognizeMediaFilePlan, executeRenamePlan, buildTemporaryRecognitionPlan, recognizeMediaFilesByRules, tryToRecognizeMediaFolderByNFO, buildSeasonsModelFromMediaMetadata } from "./TvShowPanelUtils"
import { TvShowPanelPrompts, TvShowPanelPromptsProvider, usePrompts, usePromptsContext } from "./TvShowPanelPrompts"
import { useTvShowPanelState } from "./hooks/useTvShowPanelState"
import { useTvShowFileNameGeneration } from "./hooks/useTvShowFileNameGeneration"
import { useTvShowRenaming } from "./hooks/useTvShowRenaming"
import { useTvShowWebSocketEvents } from "./hooks/useTvShowWebSocketEvents"
import { getTmdbIdFromFolderName } from "@/AppV2Utils"
import { getTvShowById } from "@/api/tmdb"
import { useConfig } from "@/providers/config-provider"
import { useDialogs } from "@/providers/dialog-provider"
import { Path } from "@core/path"
import { useGlobalStates } from "@/providers/global-states-provider"
import type { RecognizeMediaFilePlan } from "@core/types/RecognizeMediaFilePlan"
import type { RenameFilesPlan } from "@core/types/RenameFilesPlan"
import { extractUIMediaMetadataProps, type UIMediaMetadata } from "@/types/UIMediaMetadata"
import { recognizeMediaFolder } from "@/lib/recognizeMediaFolder"

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
  const { t } = useTranslation('components')
  const { pendingPlans, pendingRenamePlans, updatePlan, fetchPendingPlans, addTmpPlan } = useGlobalStates()
  const { 
    selectedMediaMetadata: mediaMetadata, 
    updateMediaMetadata,
    refreshMediaMetadata, setSelectedMediaMetadataByMediaFolderPath
   } = useMediaMetadata()
  const { filePickerDialog } = useDialogs()
  const [openFilePicker] = filePickerDialog
  const { userConfig } = useConfig()
  const toolbarOptions: ToolbarOption[] = [
    { value: "plex", label: t('toolbar.plex') } as ToolbarOption,
    { value: "emby", label: t('toolbar.emby') } as ToolbarOption,
  ]

  // Use prompts hook
  const { openUseTmdbIdFromFolderNamePrompt, openUseNfoPrompt, openRuleBasedRenameFilePrompt, openRuleBasedRecognizePrompt, openAiBasedRenameFilePrompt, openAiRecognizePrompt } = usePrompts()

  const tmdbTvShowOverviewRef = useRef<TMDBTVShowOverviewRef>(null)

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
    tmdbTvShowOverviewRef.current?.handleSelectResult(tmdbTvShow)
  }, [])

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
    tmdbTvShowOverviewRef.current?.handleSelectResult(tmdbTvShow)
  }, [])

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

  // Store latest function references in refs to avoid infinite loops in useEffect
  const openUseTmdbIdFromFolderNamePromptRef = useRef(openUseTmdbIdFromFolderNamePrompt)
  const handleUseTmdbidFromFolderNameConfirmRef = useRef(handleUseTmdbidFromFolderNameConfirm)
  
  // Update refs when functions change
  useEffect(() => {
    openUseTmdbIdFromFolderNamePromptRef.current = openUseTmdbIdFromFolderNamePrompt
    handleUseTmdbidFromFolderNameConfirmRef.current = handleUseTmdbidFromFolderNameConfirm
  }, [openUseTmdbIdFromFolderNamePrompt, handleUseTmdbidFromFolderNameConfirm])


  useEffect(() => {
    if(mediaMetadata?.mediaFolderPath === undefined) {
      return
    }

    // Don't prompt if TMDB TV show is already set
    if(mediaMetadata.tmdbTvShow !== undefined) {
      return
    }

    const tmdbIdString = getTmdbIdFromFolderName(mediaMetadata.mediaFolderPath)
    if (tmdbIdString === null) {
      return
    }

    const tmdbIdNumber = parseInt(tmdbIdString, 10)
    if (isNaN(tmdbIdNumber) || tmdbIdNumber <= 0) {
      return
    }

    // Get language from user config, default to en-US
    const language = (userConfig?.applicationLanguage || 'en-US') as 'zh-CN' | 'en-US' | 'ja-JP'

    let isCancelled = false

    // Open prompt immediately with loading state
    openUseTmdbIdFromFolderNamePromptRef.current({
      tmdbId: tmdbIdNumber,
      mediaName: undefined,
      status: "loading",
      onConfirm: handleUseTmdbidFromFolderNameConfirmRef.current,
      onCancel: () => {},
    })

    // Try to find TV Show by TMDB ID
    getTvShowById(tmdbIdNumber, language).then(response => {
      if (isCancelled) return
      
      if (response.data && !response.error) {
        // Update prompt with success state
        openUseTmdbIdFromFolderNamePromptRef.current({
          tmdbId: tmdbIdNumber,
          mediaName: response.data.name,
          status: "ready",
          onConfirm: handleUseTmdbidFromFolderNameConfirmRef.current,
          onCancel: () => {},
        })
      } else {
        // Update prompt with error state
        openUseTmdbIdFromFolderNamePromptRef.current({
          tmdbId: tmdbIdNumber,
          mediaName: undefined,
          status: "error",
          onConfirm: handleUseTmdbidFromFolderNameConfirmRef.current,
          onCancel: () => {},
        })
        toast.error(t('toolbar.queryTmdbFailed'))
      }
    }).catch(error => {
      if (isCancelled) return
      
      console.error('Failed to get TV show by ID:', error)
      // Update prompt with error state
      openUseTmdbIdFromFolderNamePromptRef.current({
        tmdbId: tmdbIdNumber,
        mediaName: undefined,
        status: "error",
        onConfirm: handleUseTmdbidFromFolderNameConfirmRef.current,
        onCancel: () => {},
      })
      toast.error(t('toolbar.queryTmdbFailed'))
    })

    // Cleanup function to prevent state updates after unmount or dependency change
    return () => {
      isCancelled = true
    }
  }, [mediaMetadata?.mediaFolderPath, mediaMetadata?.tmdbTvShow, userConfig?.applicationLanguage, t])

  // Handle AI recognition confirm - update plan (removes from pending), then apply recognized files
  const handleAiRecognizeConfirm = useCallback(async (plan: RecognizeMediaFilePlan) => {
    const traceId = `TvShowPanel-handleAiRecognizeConfirm-${nextTraceId()}`
    console.log(`[${traceId}] handleAiRecognizeConfirm CALLED`, {
      timestamp: new Date().toISOString(),
      plan,
      mediaFolderPath: mediaMetadata?.mediaFolderPath,
      stackTrace: new Error().stack
    })

    if (!mediaMetadata?.mediaFolderPath) {
      toast.error("No media folder path available")
      return
    }

    // Verify the plan's mediaFolderPath matches the current media metadata
    if (plan.mediaFolderPath !== mediaMetadata.mediaFolderPath) {
      console.warn(`[${traceId}] Plan mediaFolderPath does not match current media metadata`, {
        planPath: plan.mediaFolderPath,
        currentPath: mediaMetadata.mediaFolderPath
      })
      toast.error("Plan does not match current media folder")
      return
    }

    try {
      await updatePlan(plan.id, 'completed')
      applyRecognizeMediaFilePlan(plan, mediaMetadata, updateMediaMetadata as any, { traceId })
      console.log(`[${traceId}] Applied recognition from plan`, { planFilesCount: plan.files.length })
      toast.success(`Applied recognition for ${plan.files.length} file(s)`)
    } catch (error) {
      console.error(`[${traceId}] Error applying recognition:`, error)
      toast.error("Failed to apply recognition")
    }
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

  // Log pending plans and open prompt if plan matches current media folder
  useEffect(() => {
    console.log('[TvShowPanel] Pending plans:', pendingPlans)

    if (!mediaMetadata?.mediaFolderPath) {
      return
    }

    const plan = pendingPlans.find(
      plan =>
        plan.task === "recognize-media-file" &&
        plan.status === 'pending' &&
        plan.mediaFolderPath === mediaMetadata.mediaFolderPath
    )

    if (plan) {
      console.log('[TvShowPanel] Found plan:', plan)
      const seasons = buildSeasonsByRecognizeMediaFilePlan(mediaMetadata, plan)
      console.log('[TvShowPanel] Seasons:', seasons)
      setSeasonsForPreview(seasons)

      // Check if this is a temporary (rule-based) or persistent (AI-based) plan
      if (plan.tmp) {
        // Temporary plan - use rule-based recognition prompt
        openRuleBasedRecognizePrompt({
          onConfirm: () => {
            console.log('[TvShowPanel] Rule-based recognition confirmed')
            // Apply the recognition using the plan data
            if (mediaMetadata) {
              recognizeEpisodes(seasons, mediaMetadata, updateMediaMetadata as any)
              toast.success(t('toolbar.recognizeEpisodesSuccess'))
            }
            // Remove the temporary plan from state
            updatePlan(plan.id, 'completed').catch(error => {
              console.error('[TvShowPanel] Error removing temporary plan:', error)
            })
          },
          onCancel: () => {
            console.log('[TvShowPanel] Rule-based recognition cancelled')
            // Remove the temporary plan from state
            updatePlan(plan.id, 'rejected').catch(error => {
              console.error('[TvShowPanel] Error removing temporary plan:', error)
            })
          }
        })
        closeAiRecognizePrompt()
      } else {
        // Persistent plan - use AI-based recognition prompt
        openAiRecognizePrompt({
          status: "wait-for-ack",
          confirmButtonLabel: t('toolbar.confirm') || "Confirm",
          confirmButtonDisabled: false,
          isRenaming: false,
          onConfirm: () => handleAiRecognizeConfirm(plan),
          onCancel: async () => {
            console.log('[TvShowPanel] AI recognition cancelled')
            try {
              await updatePlan(plan.id, 'rejected')
              console.log('[TvShowPanel] Plan rejected successfully')
            } catch (error) {
              // Error handling is done in global states provider
              console.error('[TvShowPanel] Error rejecting plan:', error)
            }
          }
        })
      }
    } else {
      // No plan found - close both prompts
      closeAiRecognizePrompt()
      // Note: We don't close the rule-based prompt here since it doesn't have a close callback in the current implementation
      // This will be cleaned up in task 6.1
    }
  }, [pendingPlans, mediaMetadata?.mediaFolderPath, openAiRecognizePrompt, openRuleBasedRecognizePrompt, handleAiRecognizeConfirm, updatePlan, t, closeAiRecognizePrompt, updateMediaMetadata])

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

  return (
    <div className='p-1 w-full h-full relative'>
      <TvShowPanelPrompts />

      
      <div className="w-full h-full">
        <TMDBTVShowOverview 
          ref={tmdbTvShowOverviewRef}
          tvShow={mediaMetadata?.tmdbTvShow} 
          className="w-full h-full"
          onRenameClick={() => openRuleBasedRenameFilePrompt({
            toolbarOptions,
            selectedNamingRule,
            setSelectedNamingRule,
            onConfirm: handleRuleBasedRenameConfirm,
            onCancel: () => {},
          })}
          onRecognizeButtonClick={handleRuleBasedRecognizeButtonClick}
          ruleName={selectedNamingRule}
          seasons={
            promptsContext.isRuleBasedRecognizePromptOpen || promptsContext.isAiBasedRenameFilePromptOpen || promptsContext.isRuleBasedRecognizePromptOpen
              ? seasonsForPreview
              : seasons
          }
          isPreviewingForRename={isPreviewingForRename}
          isPreviewingForRecognize={isPreviewingForRecognize}
          scrollToEpisodeId={scrollToEpisodeId}
          onEpisodeFileSelect={handleOpenFilePickerForEpisode}
          isLoading={mediaMetadata?.status === 'initializing'}
        />
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
