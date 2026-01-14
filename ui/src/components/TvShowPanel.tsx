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
import { recognizeEpisodes, mapTagToFileType } from "./TvShowPanelUtils"
import { TvShowPanelPrompts, TvShowPanelPromptsProvider, usePrompts, usePromptsContext } from "./TvShowPanelPrompts"
import { useTvShowPanelState } from "./hooks/TvShowPanel/useTvShowPanelState"
import { useTvShowFileNameGeneration } from "./hooks/TvShowPanel/useTvShowFileNameGeneration"
import { useTvShowRenaming } from "./hooks/TvShowPanel/useTvShowRenaming"
import { useTvShowWebSocketEvents } from "./hooks/TvShowPanel/useTvShowWebSocketEvents"
import { getTmdbIdFromFolderName } from "@/AppV2Utils"
import { getTvShowById } from "@/api/tmdb"
import { useConfig } from "./config-provider"

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
    seasonsBackup,
  } = useTvShowPanelState({ 
    mediaMetadata, 
    toolbarOptions, 
    usePrompts: { 
      openUseNfoPrompt: openUseNfoPromptWithCallbacks
    } 
  })

  const latestSeasons = useLatest(seasons)

  /**
   * The message from socket.io, which will be used to send acknowledgement later when user confirms or cancels
   */
  const [pendingConfirmationMessage] = useState<any>(null)

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
    if (isNaN(tmdbIdNumber)) {
      return
    }

    // Get language from user config, default to en-US
    const language = (userConfig?.applicationLanguage || 'en-US') as 'zh-CN' | 'en-US' | 'ja-JP'

    // Try to find TV Show by TMDB ID
    getTvShowById(tmdbIdNumber, language).then(response => {
      // Only open prompt if TV show exists and no error
      if (response.data && !response.error) {
        openUseTmdbIdFromFolderNamePrompt({
          tmdbId: tmdbIdNumber,
          mediaName: response.data.name,
          onConfirm: handleUseTmdbidFromFolderNameConfirm,
          onCancel: () => {},
        })
      }
    }).catch(error => {
      console.error('Failed to get TV show by ID:', error)
    })
  }, [mediaMetadata, userConfig, openUseTmdbIdFromFolderNamePrompt, handleUseTmdbidFromFolderNameConfirm])

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

  const handleRuleBasedRenameConfirm = useCallback(() => {
    startToRenameFiles()
  }, [startToRenameFiles])

  const handleRuleBasedRecognizeConfirm = useCallback(() => {
    setSeasons(seasonsBackup.current)
    seasonsBackup.current = []
    console.log(`[TvShowPanel] seasons state restored because of user confirm`)
    if (mediaMetadata) {
      console.log(`[TvShowPanel] start to recognize episodes for media metadata:`, mediaMetadata);
      recognizeEpisodes(seasons, mediaMetadata, updateMediaMetadata);
    }
  }, [setSeasons, seasonsBackup, mediaMetadata, seasons, updateMediaMetadata])

  const handleRuleBasedRecognizeCancel = useCallback(() => {
    setSeasons(seasonsBackup.current)
    seasonsBackup.current = []
    console.log(`[TvShowPanel] seasons state restored because of user cancel`)
  }, [setSeasons, seasonsBackup])


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

      seasonsBackup.current = latestSeasons.current;
      console.log(`[TvShowPanel] backed up the seasons state`)
      setSeasons(seasonsForPreview);
      console.log(`[TvShowPanel] set the seasons state for preview`)
    
    } catch (error) {
      console.error('Error building seasons state from media metadata', error);
    }

    // seasons state will be restored on cancel button click

  }, [mediaMetadata, promptsContext.isRuleBasedRecognizePromptOpen, latestSeasons, seasonsBackup, setSeasons])

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
          seasons={seasons}
          isPreviewMode={isPreviewMode}
          scrollToEpisodeId={scrollToEpisodeId}
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
