import { TMDBTVShowOverview, type TMDBTVShowOverviewRef } from "./tmdb-tvshow-overview"
import { useMediaMetadata } from "./media-metadata-provider"
import { RuleBasedRenameFilePrompt } from "./RuleBasedRenameFilePrompt"
import { AiBasedRecognizePrompt } from "./AiBasedRecognizePrompt"
import { UseNfoPrompt } from "./UseNfoPrompt"
import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import type { MediaFileMetadata, TMDBEpisode, TMDBTVShow } from "@core/types"
import type { FileProps } from "@/lib/types"
import { findAssociatedFiles } from "@/lib/utils"
import type { MediaMetadata } from "@core/types"
import { newFileName } from "@/api/newFileName"
import { renameFile } from "@/api/renameFile"
import { extname, join } from "@/lib/path"
import { useLatest } from "react-use"
import { toast } from "sonner"
import { sendAcknowledgement, useWebSocketEvent } from "@/hooks/useWebSocket"
import { AskForRenameFilesConfirmation } from "@core/event-types"
import type { 
  AskForRenameFilesConfirmationResponseData,
  AskForRenameFilesConfirmationBeginRequestData,
  AskForRenameFilesConfirmationAddFileResponseData,
} from "@core/event-types"
import { useTranslation } from "@/lib/i18n"
import { lookup } from "@/lib/lookup"
import { AiBasedRenameFilePrompt } from "./AiBasedRenameFilePrompt"
import { RuleBasedRecognizePrompt } from "./RuleBasedRecognizePrompt"
import { recognizeEpisodes } from "./TvShowPanelUtils"
import { loadNfo } from "@/helpers/loadNfo"

function mapTagToFileType(tag: "VID" | "SUB" | "AUD" | "NFO" | "POSTER" | ""): "file" | "video" | "subtitle" | "audio" | "nfo" | "poster" {
    switch(tag) {
        case "VID":
            return "video"
        case "SUB":
            return "subtitle"
        case "AUD":
            return "audio"
        case "NFO":
            return "nfo"
        case "POSTER":
            return "poster"
        default:
            return "file"
    }
}

function newPath(mediaFolderPath: string, videoFilePath: string, associatedFilePath: string): string {
    const videoFileExtension = extname(videoFilePath)
    const associatedFileExtension = extname(associatedFilePath)
    const videoRelativePath = videoFilePath.replace(mediaFolderPath + '/', '')
    const associatedRelativePath = videoRelativePath.replace(videoFileExtension, associatedFileExtension)
    return join(mediaFolderPath, associatedRelativePath)
}

function buildFileProps(mm: MediaMetadata, seasonNumber: number, episodeNumber: number): FileProps[] {
    if(mm.mediaFolderPath === undefined) {
        console.error(`Media folder path is undefined`)
        throw new Error(`Media folder path is undefined`)
    }

    if(mm.mediaFiles === undefined) {
        return [];
    }

    if(mm.files === undefined || mm.files === null) {
        return [];
    }

    const mediaFile: MediaFileMetadata | undefined = mm.mediaFiles?.find(file => file.seasonNumber === seasonNumber && file.episodeNumber === episodeNumber)

    if(!mediaFile) {
        return [];
    }

    const episodeVideoFilePath = mediaFile.absolutePath

    const files = findAssociatedFiles(mm.mediaFolderPath, mm.files, episodeVideoFilePath)

    const fileProps: FileProps[] = [
        {
            type: "video",
            path: mediaFile.absolutePath,
        },
        ...files.map(file => ({
            type: mapTagToFileType(file.tag),
            // Convert relative path to absolute path
            path: join(mm.mediaFolderPath!, file.path),
        }))
    ];

    return fileProps;
}

export interface EpisodeModel {
    episode: TMDBEpisode,
    files: FileProps[],
}

export interface SeasonModel {
    season: import("@core/types").TMDBSeason,
    episodes: EpisodeModel[],
}


function renameFiles(mediaFolderPath: string, newVideoFilePath: string,files: FileProps[])
: FileProps[] 
 {
  const relativeVideoFilePath = newVideoFilePath.replace(mediaFolderPath + '/', '');
  const videoFileExtension = extname(newVideoFilePath);
  const relativeVideoFilePathWithoutExtension = relativeVideoFilePath.replace(videoFileExtension, '');

  const videoFile = files.find(file => file.type === "video");
  if(!videoFile) {
    return [];
  }

  const associatedFiles = 
      files.filter(file => file.type !== "video")
      .map(file => {
        const associatedFileExtension = extname(file.path);
        file.newPath = join(mediaFolderPath, relativeVideoFilePathWithoutExtension + associatedFileExtension);
        const newObj: FileProps = {
          type: file.type,
          path: file.path,
          newPath: file.newPath,
        }
        return newObj;
      })

  return [
    {
      type: "video",
      path: videoFile.path,
      newPath: newVideoFilePath,
    },
    ...(associatedFiles ?? []),
  ]
}


interface ToolbarOption {
  value: "plex" | "emby",
  label: string,
}

let seasonsBackup: SeasonModel[] = [] 

function TvShowPanel() {
  const { t } = useTranslation('components')
  const { 
    selectedMediaMetadata: mediaMetadata, 
    updateMediaMetadata,
    refreshMediaMetadata, setSelectedMediaMetadataByMediaFolderPath
   } = useMediaMetadata()
  const toolbarOptions: ToolbarOption[] = [
    { value: "plex", label: t('toolbar.plex') } as ToolbarOption,
    { value: "emby", label: t('toolbar.emby') } as ToolbarOption,
  ]
  const [selectedNamingRule, setSelectedNamingRule] = useState<"plex" | "emby">(toolbarOptions[0]?.value || "plex")
  const [seasons, setSeasons] = useState<SeasonModel[]>([])
  const [isRenaming, setIsRenaming] = useState(false)
  const latestSeasons = useLatest(seasons)
  const [confirmButtonLabel] = useState(t('toolbar.confirm'))
  const [confirmButtonDisabled] = useState(false)
  const [scrollToEpisodeId, setScrollToEpisodeId] = useState<number | null>(null)

  /**
   * The message from socket.io, which will be used to send acknowledgement later when user confirms or cancels
   */
  const [pendingConfirmationMessage] = useState<any>(null)

  // AiBasedRecognizePrompt state
  const [isRuleBasedRenameFilePromptOpen, setIsRuleBasedRenameFilePromptOpen] = useState(false)

  const [isAiBasedRenameFilePromptOpen, setIsAiBasedRenameFilePromptOpen] = useState(false)
  const [aiBasedRenameFileStatus, setAiBasedRenameFileStatus] = useState<"generating" | "wait-for-ack">("generating")

  const [isAiRecognizePromptOpen, setIsAiRecognizePromptOpen] = useState(false)
  const [aiRecognizeStatus] = useState<"generating" | "wait-for-ack">("generating")

  const [isRuleBasedRecognizePromptOpen, setIsRuleBasedRecognizePromptOpen] = useState(false)

  const [isUseNfoPromptOpen, setIsUseNfoPromptOpen] = useState(false)

  const tmdbTvShowOverviewRef = useRef<TMDBTVShowOverviewRef>(null)

  useWebSocketEvent((message) => {

    // Handle getSelectedMediaMetadata event with Socket.IO acknowledgement
    if (message.event === AskForRenameFilesConfirmation.event) {
      
      console.error(`socket event "${AskForRenameFilesConfirmation.event}" is not supported anymore`)

    } else if (message.event === AskForRenameFilesConfirmation.beginEvent) {
      console.log('AskForRenameFilesConfirmation.beginEvent received', message.data);
      const data: AskForRenameFilesConfirmationBeginRequestData = message.data as AskForRenameFilesConfirmationBeginRequestData;
      const mediaFolderPath = data.mediaFolderPath;

      setSelectedMediaMetadataByMediaFolderPath(mediaFolderPath)
      setIsAiBasedRenameFilePromptOpen(true)
      setAiBasedRenameFileStatus("generating")


      setSeasons(prev => {
        return prev.map(season => ({
          ...season,
          episodes: season.episodes.map(episode => ({
            ...episode,
            files: episode.files.map(file => ({
              ...file,
              newPath: undefined,
            })),
          })),
        }))
      })

    } else if (message.event === AskForRenameFilesConfirmation.addFileEvent) {
      console.log('AskForRenameFilesConfirmation.addFileEvent received', message.data);
      const data: AskForRenameFilesConfirmationAddFileResponseData = message.data as AskForRenameFilesConfirmationAddFileResponseData;
      const from = data.from;
      const to = data.to;
      

      setSeasons(prev => {
        let foundEpisodeId: number | null = null;
        const updatedSeasons = prev.map(season => ({
          ...season,
          episodes: season.episodes.map(episode => 
          {

            const videoFile = episode.files.find(file => file.type === "video");
            if(videoFile === undefined) {
              return episode;
            }

            if(videoFile.path !== from) {
              return episode;
            }

            // Found the matching episode, store its ID for scrolling
            foundEpisodeId = episode.episode.id;

            const newFileFromAI = {
              from: from,
              to: to,
            }

            if(newFileFromAI === undefined) {
              return episode;
            }

            const newFiles = renameFiles(mediaMetadata!.mediaFolderPath!, newFileFromAI.to, episode.files);
            return {
              episode: episode.episode,
              files: newFiles,
            }
           
          }
          ),
        }));

        // Set scroll target if episode was found
        if (foundEpisodeId !== null) {
          setScrollToEpisodeId(foundEpisodeId);
        }

        return updatedSeasons;
      })

    } else if (message.event === AskForRenameFilesConfirmation.endEvent) {
      console.log('AskForRenameFilesConfirmation.endEvent received', message.data);
      setAiBasedRenameFileStatus("wait-for-ack")
    }

  });

  // Build seasons state from media metadata
  useEffect(() => {

    if(mediaMetadata === undefined) {
      return;
    }

    if(mediaMetadata.tmdbTvShow === undefined) {
      console.log(`[TvShowPanel] trying to infer to media type`);
      if(mediaMetadata.files?.some(file => file.endsWith('/tvshow.nfo'))) {
        setIsUseNfoPromptOpen(true)
      }
    }

    setSeasons(() => {
      if(!mediaMetadata) {
        return [];
      }

      if(mediaMetadata.tmdbTvShow?.seasons === undefined) {
        return [];
      }

      console.log(`[TvShowPanel] building seasons state from media metadata`)

      return mediaMetadata.tmdbTvShow.seasons.map(season => ({
        season: season,
        episodes: season.episodes?.map(episode => ({
          episode: episode,
          files: buildFileProps(mediaMetadata, season.season_number, episode.episode_number)
        })) || []
      }))
    })

  }, [mediaMetadata])

  // Reset scrollToEpisodeId after scrolling completes
  useEffect(() => {
    if (scrollToEpisodeId !== null) {
      const timeoutId = setTimeout(() => {
        setScrollToEpisodeId(null)
      }, 500) // Reset after scrolling animation completes (100ms delay + 400ms buffer)

      return () => {
        clearTimeout(timeoutId)
      }
    }
  }, [scrollToEpisodeId])

  // Generate new file names for preview mode
  const generateNewFileNames = useCallback((selectedNamingRule: "plex" | "emby") => {
    if(!selectedNamingRule) {
      return;
    }

    if(mediaMetadata === undefined || mediaMetadata.mediaFolderPath === undefined) {
      return;
    }

    const tvShow = mediaMetadata.tmdbTvShow
    if(!tvShow) {
      return;
    }

    (async () => {
      const newSeasons = structuredClone(latestSeasons.current);
      for(const season of newSeasons) {
        for(const episode of season.episodes) {
          const videoFile = episode.files.find(file => file.type === "video");
          if(videoFile === undefined) {
            console.error(`Video file is undefined for episode ${episode.episode.episode_number} in season ${season.season.season_number}`)
            continue;
          }

          const response = await newFileName({
            ruleName: selectedNamingRule,
            type: "tv",
            seasonNumber: season.season.season_number,
            episodeNumber: episode.episode.episode_number,
            episodeName: episode.episode.name || "",
            tvshowName: tvShow.name || "",
            file: videoFile.path,
            tmdbId: tvShow.id?.toString() || "",
            releaseYear: tvShow.first_air_date ? new Date(tvShow.first_air_date).getFullYear().toString() : "",
          })
          
          if (response.data) {
            const relativePath = response.data
            const absolutePath = join(mediaMetadata.mediaFolderPath!, relativePath)
            videoFile.newPath = absolutePath
            if(videoFile.path === videoFile.newPath) {
              videoFile.newPath = undefined;
            } else {
              // Generate new paths for all associated files (subtitles, audio, nfo, poster, etc.)
              for(const file of episode.files) {
                if(file.type === "video") {
                  continue;
                }
                // Only set newPath for associated files if video file has a newPath
                file.newPath = newPath(mediaMetadata.mediaFolderPath!, absolutePath, file.path)

                if(file.path === file.newPath) {
                  file.newPath = undefined;
                }
              }
            }

          } else {
            // If video file rename failed, clear newPath for associated files
            for(const file of episode.files) {
              if(file.type !== "video") {
                file.newPath = undefined
              }
            }
          }
        }
      }
      setSeasons(newSeasons);
    })();
  }, [mediaMetadata, latestSeasons])

  // Trigger file name generation when preview mode is enabled
  useEffect(() => {

    if(!isRuleBasedRenameFilePromptOpen) {
      return;
    }
    
    generateNewFileNames(selectedNamingRule);
  }, [isRuleBasedRenameFilePromptOpen, selectedNamingRule, generateNewFileNames])

  const isPreviewMode = useMemo(() => {
    return isAiBasedRenameFilePromptOpen || isRuleBasedRenameFilePromptOpen || isRuleBasedRecognizePromptOpen
  }, [isAiBasedRenameFilePromptOpen, isRuleBasedRenameFilePromptOpen, isRuleBasedRecognizePromptOpen])


  const startToRenameFiles = useCallback(async () => {
    if(mediaMetadata === undefined || mediaMetadata.mediaFolderPath === undefined) {
      return;
    }

    // Collect all files that need to be renamed, separating video files from associated files
    const videoFilesToRename: Array<{ from: string; to: string; type: string }> = []
    const associatedFilesToRename: Array<{ from: string; to: string; type: string }> = []
    
    for (const season of latestSeasons.current) {
      for (const episode of season.episodes) {
        for (const file of episode.files) {
          if (file.newPath && file.path !== file.newPath) {
            const renameEntry = {
              from: file.path,
              to: file.newPath,
              type: file.type
            }
            
            // Separate video files from associated files
            if (file.type === "video") {
              videoFilesToRename.push(renameEntry)
            } else {
              associatedFilesToRename.push(renameEntry)
            }
          }
        }
      }
    }

    try {
      // Rename files sequentially: video files first, then associated files
      // This ensures video files are renamed before associated files that depend on them
      let successCount = 0
      let errorCount = 0
      const errors: string[] = []

      // Filter out files where from and to are identical before sending requests
      const filteredVideoFiles = videoFilesToRename.filter(({ from, to }) => from !== to)
      const filteredAssociatedFiles = associatedFilesToRename.filter(({ from, to }) => from !== to)
      
      const totalFilesToRename = filteredVideoFiles.length + filteredAssociatedFiles.length
      const skippedCount = (videoFilesToRename.length - filteredVideoFiles.length) + 
                          (associatedFilesToRename.length - filteredAssociatedFiles.length)

      if (totalFilesToRename === 0) {
        if (skippedCount > 0) {
          toast.info(`No files to rename (${skippedCount} file${skippedCount !== 1 ? 's' : ''} already have correct names)`)
        } else {
          toast.info("No files to rename")
        }
        setIsRenaming(false)
        return
      }
      
      // First, rename all video files
      console.log(`Starting rename: ${filteredVideoFiles.length} video file(s) and ${filteredAssociatedFiles.length} associated file(s)${skippedCount > 0 ? ` (${skippedCount} skipped - identical paths)` : ''}`)
      
      for (const { from, to, type } of filteredVideoFiles) {
        try {
          // TODO:
          // the renameFile API in backend will trigger mediaMetadataUpdated event
          // so mulitple readMediaMetadata API calls was triggered 
          // 1. Consider to create renameFileInBatch API
          // 2. Consider not to trigger mediaMetadataUpdated for frontend API call (still need to trigger it for AI Agent rename file)
          await renameFile({
            mediaFolder: mediaMetadata.mediaFolderPath,
            from,
            to,
          })
          successCount++
          console.log(`✓ Renamed video file: ${from} -> ${to}`)
        } catch (error) {
          errorCount++
          const errorMessage = error instanceof Error ? error.message : "Unknown error"
          errors.push(`${type} file ${from}: ${errorMessage}`)
          console.error(`✗ Failed to rename video file ${from} to ${to}:`, error)
        }
      }

      // Then, rename all associated files (subtitles, audio, nfo, poster, etc.)
      for (const { from, to, type } of filteredAssociatedFiles) {
        try {
          await renameFile({
            mediaFolder: mediaMetadata.mediaFolderPath,
            from,
            to,
          })
          successCount++
          console.log(`✓ Renamed ${type} file: ${from} -> ${to}`)
        } catch (error) {
          errorCount++
          const errorMessage = error instanceof Error ? error.message : "Unknown error"
          errors.push(`${type} file ${from}: ${errorMessage}`)
          console.error(`✗ Failed to rename ${type} file ${from} to ${to}:`, error)
        }
      }

      // Refresh media metadata after all renames
      if (successCount > 0) {
        await refreshMediaMetadata(mediaMetadata.mediaFolderPath)
      }

      // Show results
      const skippedMessage = skippedCount > 0 ? ` (${skippedCount} skipped)` : ''
      if (errorCount === 0) {
        toast.success(`Successfully renamed ${successCount} file${successCount !== 1 ? 's' : ''} (${filteredVideoFiles.length} video, ${filteredAssociatedFiles.length} associated)${skippedMessage}`)
      } else if (successCount > 0) {
        toast.warning(`Renamed ${successCount} file${successCount !== 1 ? 's' : ''}, ${errorCount} failed${skippedMessage}`)
        console.error("Rename errors:", errors)
      } else {
        toast.error(`Failed to rename ${errorCount} file${errorCount !== 1 ? 's' : ''}${skippedMessage}`)
        console.error("All rename operations failed:", errors)
      }


    } catch (error) {
      console.error("Unexpected error during rename operation:", error)
      toast.error("An unexpected error occurred during rename operation")
    }
  }, [mediaMetadata])

  // Handle confirm button click - rename all files
  const handleAiBasedRenamePromptConfirm = useCallback(async () => {
    // Send acknowledgement if there's a pending confirmation message
    if (pendingConfirmationMessage) {
      const respData: AskForRenameFilesConfirmationResponseData = {
        confirmed: true,
      }
      sendAcknowledgement(pendingConfirmationMessage, respData);
      setIsAiBasedRenameFilePromptOpen(false)
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
    } finally {
      setIsAiBasedRenameFilePromptOpen(false)
    }
    
  }, [mediaMetadata, isPreviewMode, latestSeasons, refreshMediaMetadata, pendingConfirmationMessage])


  useEffect(() => {

    if(!mediaMetadata) {
      return;
    }

    if(!isRuleBasedRecognizePromptOpen) {
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

      seasonsBackup = latestSeasons.current;
      console.log(`[TvShowPanel] backed up the seasons state`)
      setSeasons(seasonsForPreview);
      console.log(`[TvShowPanel] set the seasons state for preview`)
    
    } catch (error) {
      console.error('Error building seasons state from media metadata', error);
    }

    // seasons state will be restored on cancel button click

  }, [mediaMetadata, isRuleBasedRecognizePromptOpen])

  return (
    <div className='p-1 w-full h-full relative'>
      <div className="absolute top-0 left-0 w-full z-20">

          <UseNfoPrompt
            isOpen={isUseNfoPromptOpen}
            onConfirm={() => {
              setIsUseNfoPromptOpen(false)
              if (mediaMetadata) {
                loadNfo(mediaMetadata).then(tmdbTvShowDetails => {
                  
                  if (tmdbTvShowDetails !== undefined) {
                    console.log(`[TvShowPanel] loaded TMDB id from tvshow.nfo: ${tmdbTvShowDetails.id}`);
                    
                    // Create a minimal TMDBTVShow object with just the ID
                    // handleSelectResult will fetch the full details
                    const minimalTvShow: TMDBTVShow = {
                      id: tmdbTvShowDetails.id,
                      name: '',
                      original_name: '',
                      overview: '',
                      poster_path: null,
                      backdrop_path: null,
                      first_air_date: '',
                      vote_average: 0,
                      vote_count: 0,
                      popularity: 0,
                      genre_ids: [],
                      origin_country: [],
                      media_type: 'tv'
                    }
                    
                    // Call handleSelectResult via ref to fetch and set the TV show
                    tmdbTvShowOverviewRef.current?.handleSelectResult(minimalTvShow)
                  }
                })
              }
            }}
            onCancel={() => setIsUseNfoPromptOpen(false)}
          />

          <RuleBasedRenameFilePrompt
            isOpen={isRuleBasedRenameFilePromptOpen}
            namingRuleOptions={toolbarOptions}
            selectedNamingRule={selectedNamingRule}
            onNamingRuleChange={(value) => {
              setSelectedNamingRule(value as "plex" | "emby")
            }}
            onConfirm={() => {
              setIsRuleBasedRenameFilePromptOpen(false)
              startToRenameFiles();
            }}
            onCancel={() => setIsRuleBasedRenameFilePromptOpen(false)}
          />

          <AiBasedRenameFilePrompt
            isOpen={isAiBasedRenameFilePromptOpen}
            status={aiBasedRenameFileStatus}
            onConfirm={handleAiBasedRenamePromptConfirm}
            onCancel={() => setIsAiBasedRenameFilePromptOpen(false)}
          />

          <AiBasedRecognizePrompt
              isOpen={isAiRecognizePromptOpen}
              status={aiRecognizeStatus}
              onConfirm={() => {
                setIsAiRecognizePromptOpen(false)
              }}
              onCancel={() => {
                setIsAiRecognizePromptOpen(false)
              }}
              confirmLabel={confirmButtonLabel}
              isConfirmButtonDisabled={confirmButtonDisabled}
              isConfirmDisabled={isRenaming}
            />

          <RuleBasedRecognizePrompt
            isOpen={isRuleBasedRecognizePromptOpen}
            onConfirm={() => {
              setIsRuleBasedRecognizePromptOpen(false)
              setSeasons(seasonsBackup)
              seasonsBackup = []
              console.log(`[TvShowPanel] seasons state restored because of user confirm`)
              if (mediaMetadata) {
                console.log(`[TvShowPanel] start to recognize episodes for media metadata:`, mediaMetadata);
                recognizeEpisodes(seasons, mediaMetadata, updateMediaMetadata);
              }
              
            }}
            onCancel={() => {
              setIsRuleBasedRecognizePromptOpen(false)
              setSeasons(seasonsBackup)
              seasonsBackup = []
              console.log(`[TvShowPanel] seasons state restored because of user cancel`)
            }}
          />

          
      </div>

      
      <div className="w-full h-full">
        <TMDBTVShowOverview 
          ref={tmdbTvShowOverviewRef}
          tvShow={mediaMetadata?.tmdbTvShow} 
          className="w-full h-full"
          onRenameClick={() => {setIsRuleBasedRenameFilePromptOpen(true)}}
          onRecognizeButtonClick={() => {setIsRuleBasedRecognizePromptOpen(true)}}
          ruleName={selectedNamingRule}
          seasons={seasons}
          isPreviewMode={isPreviewMode}
          scrollToEpisodeId={scrollToEpisodeId}
        />
      </div>
    </div>
  )
}

export default TvShowPanel