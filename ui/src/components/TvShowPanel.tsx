import { TMDBTVShowOverview, type TMDBTVShowOverviewRef } from "./tmdb-tvshow-overview"
import { useMediaMetadata } from "./media-metadata-provider"
import { useState, useEffect, useCallback, useRef } from "react"
import type { TMDBEpisode, TMDBTVShow } from "@core/types"
import type { FileProps } from "@/lib/types"
import { findAssociatedFiles } from "@/lib/utils"
import { join } from "@/lib/path"
import { useLatest } from "react-use"
import { toast } from "sonner"
import { sendAcknowledgement } from "@/hooks/useWebSocket"
import type { 
  AskForRenameFilesConfirmationResponseData,
} from "@core/event-types"
import { useTranslation } from "@/lib/i18n"
import { lookup } from "@/lib/lookup"
import { recognizeEpisodes, mapTagToFileType, updateMediaFileMetadatas } from "./TvShowPanelUtils"
import { TvShowPanelPrompts, TvShowPanelPromptsProvider, usePrompts, usePromptsContext } from "./TvShowPanelPrompts"
import { useTvShowPanelState } from "./hooks/TvShowPanel/useTvShowPanelState"
import { useTvShowFileNameGeneration } from "./hooks/TvShowPanel/useTvShowFileNameGeneration"
import { useTvShowRenaming } from "./hooks/TvShowPanel/useTvShowRenaming"
import { useTvShowWebSocketEvents } from "./hooks/TvShowPanel/useTvShowWebSocketEvents"
import { getTmdbIdFromFolderName } from "@/AppV2Utils"
import { getTvShowById } from "@/api/tmdb"
import { useConfig } from "./config-provider"
import { useDialogs } from "./dialog-provider"
import { Path } from "@core/path"

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
  const { openUseTmdbIdFromFolderNamePrompt, openUseNfoPrompt, openRuleBasedRenameFilePrompt, openRuleBasedRecognizePrompt, openAiBasedRenameFilePrompt } = usePrompts()

  const tmdbTvShowOverviewRef = useRef<TMDBTVShowOverviewRef>(null)

  // Callback handlers for prompts
  const handleUseNfoConfirm = useCallback((tmdbTvShow: TMDBTVShow) => {
    if (!tmdbTvShow || !tmdbTvShow.id) {
      console.error('[TvShowPanel] handleUseNfoConfirm called with invalid tmdbTvShow:', tmdbTvShow)
      return
    }
    console.log(`[TvShowPanel] loaded TMDB id from tvshow.nfo: ${tmdbTvShow.id}`);
    tmdbTvShowOverviewRef.current?.handleSelectResult(tmdbTvShow)
  }, [])

  const handleUseTmdbidFromFolderNameConfirm = useCallback((tmdbTvShow: TMDBTVShow) => {
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

  // Use renaming hook
  const { startToRenameFiles } = useTvShowRenaming({
    seasons,
    mediaMetadata,
    refreshMediaMetadata,
    setIsRenaming,
  })

  // Handle confirm button click - rename all files
  const handleAiBasedRenamePromptConfirm = useCallback(async () => {
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
    updateMediaMetadata(mediaMetadata.mediaFolderPath, {
      ...mediaMetadata,
      mediaFiles: updatedMediaFiles
    })

    toast.success("File added successfully")
  }, [mediaMetadata, updateMediaMetadata])

  // Handle opening file picker for episode
  const handleOpenFilePickerForEpisode = useCallback((episode: TMDBEpisode, _file?: { path: string; isDirectory?: boolean }) => {


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
    startToRenameFiles()
  }, [startToRenameFiles])

  const handleRuleBasedRecognizeConfirm = useCallback(() => {
    if (mediaMetadata) {
      console.log(`[TvShowPanel] start to recognize episodes for media metadata:`, mediaMetadata);
      recognizeEpisodes(seasons, mediaMetadata, updateMediaMetadata);
    }
  }, [mediaMetadata, seasons, updateMediaMetadata])

  const handleRuleBasedRecognizeCancel = useCallback(() => {
    // No-op: seasons state is no longer mutated, so no restoration needed
  }, [])


  // Get prompt states for preview mode calculation (promptsContext already declared above)
  const isPreviewMode = promptsContext.isAiBasedRenameFilePromptOpen || promptsContext.isRuleBasedRenameFilePromptOpen || promptsContext.isRuleBasedRecognizePromptOpen

  useEffect(() => {

    if(!mediaMetadata) {
      return;
    }

    if(!promptsContext.isRuleBasedRecognizePromptOpen) {
      return;
    }


    try {

      const seasonsForPreview: SeasonModel[] = structuredClone(latestSeasons.current);
      console.log(`[TvShowPanel] cloned seasons model:`, seasonsForPreview);
      const updateSeasonsForPreview = (seasonNumber: number, episodeNumber: number, videoFilePath: string) => {
        // Find the matching season and episode
        const season = seasonsForPreview.find(s => s.season.season_number === seasonNumber);
        if (!season) {
          return;
        }

        const episode = season.episodes.find(ep => ep.episode.episode_number === episodeNumber);
        if (!episode) {
          return;
        }

        // Check that mediaMetadata has required properties
        if (!mediaMetadata.mediaFolderPath || !mediaMetadata.files) {
          return;
        }

        // Find associated files (subtitles, audio, nfo, poster)
        const associatedFiles = findAssociatedFiles(mediaMetadata.mediaFolderPath, mediaMetadata.files, videoFilePath);

        // Build the new files array
        const newFiles: FileProps[] = [
          {
            type: "video",
            path: videoFilePath,
          },
          ...associatedFiles.map(file => ({
            type: mapTagToFileType(file.tag),
            // Convert relative path to absolute path
            path: join(mediaMetadata.mediaFolderPath!, file.path),
          }))
        ];

        // Update the episode's files
        episode.files = newFiles;
      }

      mediaMetadata.tmdbTvShow?.seasons.forEach(season => {
        season.episodes?.forEach(episode => {

          const mediaFile = mediaMetadata.mediaFiles?.find(file => file.seasonNumber === season.season_number && file.episodeNumber === episode.episode_number)
          if(!mediaFile) {
            const videoFilePath = lookup(mediaMetadata.files!, season.season_number, episode.episode_number);
            console.log(`[TvShowPanel] video file path for season ${season.season_number} episode ${episode.episode_number} is ${videoFilePath}`);

            if(videoFilePath !== null) {
              updateSeasonsForPreview(season.season_number, episode.episode_number, videoFilePath);
            }
            

          }
        })
      })

      console.log(`[TvShowPanel] seasons for preview:`, seasonsForPreview);
      setSeasonsForPreview(seasonsForPreview);
      console.log(`[TvShowPanel] set the seasonsForPreview state`)
    
    } catch (error) {
      console.error('Error building seasons state from media metadata', error);
    }

  }, [mediaMetadata, promptsContext.isRuleBasedRecognizePromptOpen, latestSeasons])

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
          onRecognizeButtonClick={() => openRuleBasedRecognizePrompt({
            onConfirm: handleRuleBasedRecognizeConfirm,
            onCancel: handleRuleBasedRecognizeCancel,
          })}
          ruleName={selectedNamingRule}
          seasons={promptsContext.isRuleBasedRecognizePromptOpen ? seasonsForPreview : seasons}
          isPreviewMode={isPreviewMode}
          scrollToEpisodeId={scrollToEpisodeId}
          onEpisodeFileSelect={handleOpenFilePickerForEpisode}
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
