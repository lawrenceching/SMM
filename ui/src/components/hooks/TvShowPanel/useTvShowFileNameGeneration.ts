import { useCallback, useEffect } from "react"
import { useLatest } from "react-use"
import type { MediaMetadata } from "@core/types"
import type { SeasonModel } from "../../TvShowPanel"
import { newFileName } from "@/api/newFileName"
import { newPath } from "../../TvShowPanelUtils"
import { join } from "@/lib/path"

interface UseTvShowFileNameGenerationParams {
  seasons: SeasonModel[]
  setSeasons: (updater: (prev: SeasonModel[]) => SeasonModel[]) => void
  mediaMetadata: MediaMetadata | undefined
  selectedNamingRule: "plex" | "emby"
  isRuleBasedRenameFilePromptOpen: boolean
}

export function useTvShowFileNameGeneration({
  seasons,
  setSeasons,
  mediaMetadata,
  selectedNamingRule,
  isRuleBasedRenameFilePromptOpen,
}: UseTvShowFileNameGenerationParams) {
  const latestSeasons = useLatest(seasons)

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
      setSeasons(() => newSeasons);
    })();
  }, [mediaMetadata, latestSeasons, setSeasons])

  // Trigger file name generation when preview mode is enabled
  useEffect(() => {
    if(!isRuleBasedRenameFilePromptOpen) {
      return;
    }
    
    generateNewFileNames(selectedNamingRule);
  }, [isRuleBasedRenameFilePromptOpen, selectedNamingRule, generateNewFileNames])

  return {
    generateNewFileNames,
  }
}
