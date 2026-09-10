import { useCallback, useMemo } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useFetchMediaMetadataMutation } from "@/hooks/mediaMetadata/useFetchMediaMetadataMutation"
import { useUpdateMediaMetadataMutation } from "@/hooks/mediaMetadata/useUpdateMediaMetadataMutation"
import { normalizeMediaFolderPathForQuery, mediaMetadataQueryKey } from "@/lib/mediaMetadataQueryKeys"
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore"
import { Path } from "@smm/utils/path"
import type { MediaMetadata, TMDBMovie, TMDBTVShow } from "@smm/types"
import { recognizeFolderViaCore } from "@/api/recognizeFolder"
import { toast } from "sonner"
import type { SearchLanguage } from "@/components/MediaDatabaseSearchbox"
import type { TVDBSearchItem } from "@/lib/tvdbSearchNormalize"
import type { TVDBv4SearchResult } from "@smm/tvdb4"

export type SelectTvShowForFolderVariables =
  | {
      mediaFolderPath: string
      database: "TMDB"
      result: TMDBTVShow | TMDBMovie
      searchLanguage: SearchLanguage
    }
  | {
      mediaFolderPath: string
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
    return String((result as TVDBv4SearchResult).tvdb_id)
  }
  return String((result as TMDBTVShow | TMDBMovie).id)
}

export function useSelectTvShowForFolderMutation() {
  const queryClient = useQueryClient()
  const { mutateAsync: fetchMediaMetadata } = useFetchMediaMetadataMutation()
  const updateMediaMetadataMutation = useUpdateMediaMetadataMutation()

  const updateMediaMetadata = useCallback(
    async (
      path: string,
      updaterOrMetadata: MediaMetadata | ((current: MediaMetadata) => MediaMetadata),
      options?: { traceId?: string },
    ) => {
      const pathPosix = normalizeMediaFolderPathForQuery(path)
      if (!pathPosix) return
      const current = (await fetchMediaMetadata({ path: pathPosix, traceId: options?.traceId })) as MediaMetadata
      const next =
        typeof updaterOrMetadata === "function"
          ? updaterOrMetadata(current)
          : updaterOrMetadata
      await updateMediaMetadataMutation.mutateAsync({
        pathPosix,
        metadata: next,
        traceId: options?.traceId,
      })
    },
    [fetchMediaMetadata, updateMediaMetadataMutation],
  )

  const setFolderStatus = useUIMediaFolderStore.getState().updateFolderStatus

  const recognizeFolderMutation = useMutation({
    mutationFn: async (variables: SelectTvShowForFolderVariables) => {
      await recognizeFolderViaCore({
        path: variables.mediaFolderPath,
        db: recognizeDb(variables.database),
        id: recognizeId(variables.database, variables.result),
      })
    },
    onMutate: (variables) => {
      setFolderStatus(Path.toPlatformPath(variables.mediaFolderPath), "loading")
    },
    onSuccess: (_data, variables) => {
      const pathPosix = normalizeMediaFolderPathForQuery(variables.mediaFolderPath)
      if (pathPosix) {
        void queryClient.invalidateQueries({ queryKey: mediaMetadataQueryKey(pathPosix) })
      }
      setFolderStatus(Path.toPlatformPath(variables.mediaFolderPath), "ok")
    },
    onError: (error, variables) => {
      toast.error(error instanceof Error ? error.message : "Failed to recognize folder")
      setFolderStatus(Path.toPlatformPath(variables.mediaFolderPath), "ok")
    },
  })

  const selectTvShowForFolderMutation = useMemo(
    () => ({
      mutate: recognizeFolderMutation.mutate,
      mutateAsync: recognizeFolderMutation.mutateAsync,
    }),
    [recognizeFolderMutation],
  )

  return {
    selectTvShowForFolderMutation,
    isSelectTvShowForFolderPending: recognizeFolderMutation.isPending,
    updateMediaMetadata,
  }
}
