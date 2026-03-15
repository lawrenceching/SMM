import { useCallback } from "react"
import type { MediaMetadata } from "@core/types"
import type { RenameFilesPlan } from "@core/types/RenameFilesPlan"
import { newFileName } from "@/api/newFileName"
import { join } from "@/lib/path"


interface UseTvShowFileNameGenerationParams {
  mediaMetadata: MediaMetadata | undefined
  selectedNamingRule: "plex" | "emby"
}

export function useTvShowFileNameGeneration({
  mediaMetadata,
}: UseTvShowFileNameGenerationParams) {

  // Generate new file names for preview mode
  const generateNewFileNames = useCallback(async (selectedNamingRule: "plex" | "emby"): Promise<RenameFilesPlan | null> => {
    if(!selectedNamingRule) {
      return null;
    }

    if(mediaMetadata === undefined || mediaMetadata.mediaFolderPath === undefined) {
      return null;
    }

    const tvShow = mediaMetadata.tmdbTvShow
    if(!tvShow) {
      return null;
    }

    const files: Array<{ from: string; to: string }> = [];

    // Process each season and episode
    for(const season of tvShow.seasons) {
      if(!season.episodes) continue;
      
      for(const episode of season.episodes) {
        // Find the media file for this episode
        const mediaFile = mediaMetadata.mediaFiles?.find(
          file => file.seasonNumber === season.season_number && file.episodeNumber === episode.episode_number
        );
        
        if(!mediaFile) continue;

        const response = await newFileName({
          ruleName: selectedNamingRule,
          type: "tv",
          seasonNumber: season.season_number,
          episodeNumber: episode.episode_number,
          episodeName: episode.name || "",
          tvshowName: tvShow.name || "",
          file: mediaFile.absolutePath,
          tmdbId: tvShow.id?.toString() || "",
          releaseYear: tvShow.first_air_date ? new Date(tvShow.first_air_date).getFullYear().toString() : "",
        });
        
        if (response.data) {
          const relativePath = response.data;
          const absolutePath = join(mediaMetadata.mediaFolderPath!, relativePath);
          
          files.push({
            from: mediaFile.absolutePath,
            to: absolutePath
          });

          console.log(`[TvShowPanel] generated new file name for episode ${season.season_number}x${episode.episode_number}: ${relativePath}`)

        }
      }
    }

    // Create and return the rename plan
    const renamePlan: RenameFilesPlan = {
      id: crypto.randomUUID(),
      task: "rename-files",
      status: "pending",
      mediaFolderPath: mediaMetadata.mediaFolderPath,
      files: files,
    };

    return renamePlan;
  }, [mediaMetadata])

  return {
    generateNewFileNames,
  }
}
