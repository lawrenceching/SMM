import { TMDBTVShowOverview } from "./tmdb-tvshow-overview"
import { useMediaMetadata } from "./media-metadata-provider"
import { FloatingToolbar } from "./FloatingToolbar"
import { useState, useEffect, useCallback } from "react"
import type { MediaFileMetadata, TMDBEpisode } from "@core/types"
import type { FileProps } from "@/lib/types"
import { findAssociatedFiles } from "@/lib/utils"
import type { MediaMetadata } from "@core/types"
import { newFileName } from "@/api/newFileName"
import { renameFile } from "@/api/renameFile"
import { extname, join } from "@/lib/path"
import { useLatest } from "react-use"
import { toast } from "sonner"

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

interface ToolbarOption {
  value: "plex" | "emby",
  label: string,
}

function TvShowPanel() {
  const { selectedMediaMetadata: mediaMetadata, refreshMediaMetadata } = useMediaMetadata()
  const [isToolbarOpen, setIsToolbarOpen] = useState(false)
  const toolbarOptions: ToolbarOption[] = [
    { value: "plex", label: "Plex" } as ToolbarOption,
    { value: "emby", label: "Emby" } as ToolbarOption,
  ]
  const [selectedNamingRule, setSelectedNamingRule] = useState<"plex" | "emby">(toolbarOptions[0]?.value || "plex")
  const [seasons, setSeasons] = useState<SeasonModel[]>([])
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const latestSeasons = useLatest(seasons)
  const [toolbarMode, setToolbarMode] = useState<"manual" | "ai">("manual")

  const openToolbar = useCallback((toolbarMode: "manual" | "ai") => {
    setToolbarMode(toolbarMode)
    setIsToolbarOpen(true)
  }, [setToolbarMode, setIsToolbarOpen])

  // Build seasons state from media metadata
  useEffect(() => {
    setSeasons(() => {
      if(!mediaMetadata) {
        return [];
      }

      if(mediaMetadata.tmdbTvShow?.seasons === undefined) {
        return [];
      }

      return mediaMetadata.tmdbTvShow.seasons.map(season => ({
        season: season,
        episodes: season.episodes?.map(episode => ({
          episode: episode,
          files: buildFileProps(mediaMetadata, season.season_number, episode.episode_number)
        })) || []
      }))
    })
  }, [mediaMetadata])

  // Generate new file names for preview mode
  const generateNewFileNames = useCallback(() => {
    if(!isPreviewMode || !selectedNamingRule) {
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

            // Generate new paths for all associated files (subtitles, audio, nfo, poster, etc.)
            for(const file of episode.files) {
              if(file.type === "video") {
                continue;
              }
              // Only set newPath for associated files if video file has a newPath
              file.newPath = newPath(mediaMetadata.mediaFolderPath!, absolutePath, file.path)
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
  }, [mediaMetadata, selectedNamingRule, isPreviewMode, latestSeasons])

  // Trigger file name generation when preview mode is enabled
  useEffect(() => {
    if(!isPreviewMode) {
      return;
    }
    generateNewFileNames();
  }, [isPreviewMode, selectedNamingRule, generateNewFileNames])

  // Handle confirm button click - rename all files
  const handleConfirm = useCallback(async () => {
    if (!mediaMetadata?.mediaFolderPath) {
      toast.error("No media folder path available")
      return
    }

    if (!isPreviewMode) {
      setIsToolbarOpen(false)
      return
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

    setIsRenaming(true)

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
        setIsToolbarOpen(false)
        setIsPreviewMode(false)
        setIsRenaming(false)
        return
      }
      
      // First, rename all video files
      console.log(`Starting rename: ${filteredVideoFiles.length} video file(s) and ${filteredAssociatedFiles.length} associated file(s)${skippedCount > 0 ? ` (${skippedCount} skipped - identical paths)` : ''}`)
      
      for (const { from, to, type } of filteredVideoFiles) {
        try {
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

      // Close toolbar and exit preview mode
      setIsToolbarOpen(false)
      setIsPreviewMode(false)
    } catch (error) {
      console.error("Unexpected error during rename operation:", error)
      toast.error("An unexpected error occurred during rename operation")
    } finally {
      setIsRenaming(false)
    }
  }, [mediaMetadata, isPreviewMode, latestSeasons, refreshMediaMetadata])



  return (
    <div className='p-1 w-full h-full relative'>
      <button onClick={() => openToolbar("ai")}>ai rename</button>
      <FloatingToolbar 
        isOpen={isToolbarOpen}
        options={toolbarOptions}
        selectedValue={selectedNamingRule}
        onValueChange={(value) => {setSelectedNamingRule(value as "plex" | "emby")}}
        onConfirm={handleConfirm}
        onCancel={() => {
          setIsToolbarOpen(false)
          setIsPreviewMode(false)
        }}
        confirmLabel={isRenaming ? "Renaming..." : "Confirm"}
        isConfirmDisabled={isRenaming}
        mode={toolbarMode}
      />
      <div className="w-full h-full">
        <TMDBTVShowOverview 
          tvShow={mediaMetadata?.tmdbTvShow} 
          className="w-full h-full"
          onRenameClick={() => openToolbar("manual")}
          ruleName={selectedNamingRule}
          seasons={seasons}
          isPreviewMode={isPreviewMode}
          setIsPreviewMode={setIsPreviewMode}
        />
      </div>
    </div>
  )
}

export default TvShowPanel