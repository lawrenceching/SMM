import { useCallback } from "react"
import type { MediaMetadata } from "@core/types"
import type { RenameFilesPlan } from "@core/types/RenameFilesPlan"
import { generateNewFileName } from "@/lib/renameRules"
import { join } from "@/lib/path"

interface UseTvShowFileNameGenerationParams {
  mediaMetadata: MediaMetadata | undefined
  selectedNamingRule: "plex" | "emby"
}

export function useTvShowFileNameGeneration({
  mediaMetadata,
}: UseTvShowFileNameGenerationParams) {
  const generateNewFileNames = useCallback(
    (selectedNamingRule: "plex" | "emby"): RenameFilesPlan | null => {
      if (!selectedNamingRule) {
        return null
      }

      if (mediaMetadata === undefined || mediaMetadata.mediaFolderPath === undefined) {
        return null
      }

      const tvShow = mediaMetadata.tvShow
      if (!tvShow) {
        return null
      }

      const files: Array<{ from: string; to: string }> = []

      for (const season of tvShow.seasons) {
        if (!season.episodes) continue

        for (const episode of season.episodes) {
          const mediaFile = mediaMetadata.mediaFiles?.find(
            file => file.seasonNumber === season.season && file.episodeNumber === episode.episode,
          )

          if (!mediaFile) continue

          const relativePath = generateNewFileName(selectedNamingRule, {
            type: "tv",
            seasonNumber: season.season,
            episodeNumber: episode.episode,
            episodeName: episode.name || "",
            tvshowName: tvShow.name || "",
            file: mediaFile.absolutePath,
            tmdbId: tvShow.id?.toString() || "",
            releaseYear: tvShow.airDate ?? "",
          })

          const absolutePath = join(mediaMetadata.mediaFolderPath!, relativePath)

          files.push({
            from: mediaFile.absolutePath,
            to: absolutePath,
          })

          console.log(
            `[TvShowPanel] generated new file name for episode ${season.season}x${episode.episode}: ${relativePath}`,
          )
        }
      }

      const renamePlan: RenameFilesPlan = {
        id: crypto.randomUUID(),
        task: "rename-files",
        status: "pending",
        creator: "app",
        mediaFolderPath: mediaMetadata.mediaFolderPath,
        files,
      }

      return renamePlan
    },
    [mediaMetadata],
  )

  return {
    generateNewFileNames,
  }
}
