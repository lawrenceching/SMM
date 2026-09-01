import { useMemo } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { normalizeMediaFolderPathForQuery, mediaMetadataQueryKey } from "@/lib/mediaMetadataQueryKeys"
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore"
import type { MediaMetadata, TMDBMovie, TMDBTVShow } from "@smm/types"
import { recognizeFolderViaCore } from "@/api/recognizeFolder"
import { toast } from "sonner"
import type { SearchLanguage } from "@/components/MediaDatabaseSearchbox"
import type { TVDBSearchItem } from "@/lib/tvdbSearchNormalize"

export type SelectMovieForFolderVariables =
  | {
      mediaFolderPath: string
      baseMetadata: MediaMetadata
      database: "TMDB"
      result: TMDBTVShow | TMDBMovie
      searchLanguage: SearchLanguage
    }
  | {
      mediaFolderPath: string
      baseMetadata: MediaMetadata
      database: "TVDB"
      result: TVDBSearchItem
      searchLanguage: SearchLanguage
    }

function recognizeDb(database: "TMDB" | "TVDB"): "tmdb" | "tvdb" {
  return database === "TVDB" ? "tvdb" : "tmdb"
}

function recognizeId(
  database: "TMDB" | "TVDB",
  result: TMDBTVShow | TMDBMovie | TVDBSearchItem,
): string {
  if (database === "TVDB") {
    return String((result as TVDBSearchItem).tvdb_id)
  }
  return String((result as TMDBTVShow | TMDBMovie).id)
}

export function useSelectMovieForFolderMutation() {
  const queryClient = useQueryClient()

  const recognizeFolderMutation = useMutation({
    mutationFn: async (variables: SelectMovieForFolderVariables) => {
      await recognizeFolderViaCore({
        path: variables.mediaFolderPath,
        db: recognizeDb(variables.database),
        id: recognizeId(variables.database, variables.result),
      })
    },
    onMutate: (variables) => {
      useUIMediaFolderStore.getState().updateFolderStatus(variables.mediaFolderPath, "loading")
    },
    onSuccess: (_data, variables) => {
      const pathPosix = normalizeMediaFolderPathForQuery(variables.mediaFolderPath)
      if (pathPosix) {
        void queryClient.invalidateQueries({ queryKey: mediaMetadataQueryKey(pathPosix) })
      }
      useUIMediaFolderStore.getState().updateFolderStatus(variables.mediaFolderPath, "ok")
    },
    onError: (error, variables) => {
      toast.error(error instanceof Error ? error.message : "Failed to recognize folder")
      useUIMediaFolderStore.getState().updateFolderStatus(variables.mediaFolderPath, "ok")
    },
  })

  const selectMovieForFolderMutation = useMemo(
    () => ({
      mutate: recognizeFolderMutation.mutate,
      mutateAsync: recognizeFolderMutation.mutateAsync,
    }),
    [recognizeFolderMutation],
  )

  return {
    selectMovieForFolderMutation,
    isSelectMovieForFolderPending: recognizeFolderMutation.isPending,
  }
}
