import { useCallback } from "react"
import type { MediaMetadata } from "@core/types"
import type { RenameFilesPlan } from "@core/types/RenameFilesPlan"
import { buildTvShowRenamePlanFileEntries } from "@/lib/buildTvShowRenamePlanFileEntries"

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

      const files = buildTvShowRenamePlanFileEntries(mediaMetadata, selectedNamingRule)

      if (files.length === 0) {
        return null
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
