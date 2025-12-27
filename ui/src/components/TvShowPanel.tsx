import { TMDBTVShowOverview } from "./tmdb-tvshow-overview"
import { useMediaMetadata } from "./media-metadata-provider"
import { FloatingToolbar } from "./FloatingToolbar"
import { useState, useEffect, useCallback } from "react"
import type { MediaFileMetadata, TMDBEpisode } from "@core/types"
import type { FileProps } from "@/lib/types"
import { findAssociatedFiles } from "@/lib/utils"
import type { MediaMetadata } from "@core/types"
import { newFileName } from "@/api/newFileName"
import { extname, join } from "@/lib/path"
import { useLatest } from "react-use"

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
        console.error(`Media files are undefined`)
        throw new Error(`Media files are undefined`)
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
            path: file.path,
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
  const { selectedMediaMetadata: mediaMetadata } = useMediaMetadata()
  const [isToolbarOpen, setIsToolbarOpen] = useState(false)
  const toolbarOptions: ToolbarOption[] = [
    { value: "plex", label: "Plex" } as ToolbarOption,
    { value: "emby", label: "Emby" } as ToolbarOption,
  ]
  const [selectedNamingRule, setSelectedNamingRule] = useState<"plex" | "emby">(toolbarOptions[0]?.value || "plex")
  const [seasons, setSeasons] = useState<SeasonModel[]>([])
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const latestSeasons = useLatest(seasons)

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
          }

          for(const file of episode.files) {
            if(file.type === "video") {
              continue;
            }
            file.newPath = newPath(mediaMetadata.mediaFolderPath!, videoFile.newPath!, file.path)
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

  return (
    <div className='p-1 w-full h-full relative'>
      <FloatingToolbar 
        isOpen={isToolbarOpen}
        options={toolbarOptions}
        selectedValue={selectedNamingRule}
        onValueChange={(value) => {setSelectedNamingRule(value as "plex" | "emby")}}
        onConfirm={() => {
          console.log("Confirm clicked")
          setIsToolbarOpen(false)
        }}
        onCancel={() => {
          console.log("Cancel clicked")
          setIsToolbarOpen(false)
        }}
      />
      <div className="w-full h-full">
        <TMDBTVShowOverview 
          tvShow={mediaMetadata?.tmdbTvShow} 
          className="w-full h-full"
          onRenameClick={() => setIsToolbarOpen(true)}
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