import { useCallback, useMemo } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useFetchMediaMetadataMutation } from "@/hooks/mediaMetadata/useFetchMediaMetadataMutation"
import { useUpdateMediaMetadataMutation } from "@/hooks/mediaMetadata/useUpdateMediaMetadataMutation"
import { normalizeMediaFolderPathForQuery, mediaMetadataQueryKey } from "@/lib/mediaMetadataQueryKeys"
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore"
import { Path } from "@core/path"
import type { MediaMetadata, TMDBMovie, TMDBTVShow, TvShowMediaMetadata } from "@core/types"
import { useGetTmdbTvShowMutation } from "@/hooks/useGetTmdbTvShowMutation"
import { useGetTvdbTvShowMutation } from "@/hooks/useGetTvdbTvShowMutation"
import { recognizeFolderViaCore } from "@/api/recognizeFolder"
import { isSmmV3Enabled } from "@/lib/localStorages"
import { nextTraceId } from "@/lib/utils"
import { toast } from "sonner"
import type { SearchLanguage } from "@/components/MediaDatabaseSearchbox"
import type { TVDBSearchItem } from "@/lib/tvdbSearchNormalize"
import type { TVDBv4SearchResult } from "@smm/tvdb4"

type ApplyTmdbTvShowSelectionVars = {
  id: number
  language?: string
  mediaFolderPath: string
  traceId: string
}

type ApplyTvdbTvShowSelectionVars = {
  seriesId: number
  language?: string
  mediaFolderPath: string
  traceId: string
}

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

  const onMutateLegacy = useCallback(
    (variables: { mediaFolderPath: string }) => {
      setFolderStatus(Path.toPlatformPath(variables.mediaFolderPath), "loading")
      void updateMediaMetadata(variables.mediaFolderPath, (prev) => ({
        ...prev,
        tvShow: undefined,
      }))
    },
    [setFolderStatus, updateMediaMetadata],
  )

  const onSuccessLegacy = useCallback(
    (tvShow: TvShowMediaMetadata, variables: { mediaFolderPath: string }) => {
      void updateMediaMetadata(variables.mediaFolderPath, (prev) => ({
        ...prev,
        tvShow,
      }))
      setFolderStatus(Path.toPlatformPath(variables.mediaFolderPath), "ok")
    },
    [setFolderStatus, updateMediaMetadata],
  )

  const onErrorLegacy = useCallback((error: Error, variables: { mediaFolderPath: string }) => {
    toast.error(error instanceof Error ? error.message : "Failed to get TV show details")
    setFolderStatus(Path.toPlatformPath(variables.mediaFolderPath), "ok")
  }, [setFolderStatus])

  const applyTmdbTvShowSelectionMutation = useGetTmdbTvShowMutation<ApplyTmdbTvShowSelectionVars>({
    onMutate: onMutateLegacy,
    onSuccess: onSuccessLegacy,
    onError: onErrorLegacy,
  })

  const applyTvdbTvShowSelectionMutation = useGetTvdbTvShowMutation<ApplyTvdbTvShowSelectionVars>({
    onMutate: onMutateLegacy,
    onSuccess: onSuccessLegacy,
    onError: onErrorLegacy,
  })

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

  const mutateLegacy = useCallback(
    (variables: SelectTvShowForFolderVariables) => {
      const { database, result, searchLanguage, mediaFolderPath } = variables
      const traceId = `TvShowSearchResultSelected-${nextTraceId()}`

      if (database === "TVDB") {
        const selectedTvdbSearchResult = result as TVDBv4SearchResult
        applyTvdbTvShowSelectionMutation.mutate({
          seriesId: Number(selectedTvdbSearchResult.tvdb_id),
          language: searchLanguage,
          mediaFolderPath,
          traceId,
        })
      } else {
        applyTmdbTvShowSelectionMutation.mutate({
          id: result.id,
          language: searchLanguage,
          mediaFolderPath,
          traceId,
        })
      }
    },
    [applyTmdbTvShowSelectionMutation, applyTvdbTvShowSelectionMutation],
  )

  const mutateAsyncLegacy = useCallback(
    async (variables: SelectTvShowForFolderVariables) => {
      const { database, result, searchLanguage, mediaFolderPath } = variables
      const traceId = `TvShowSearchResultSelected-${nextTraceId()}`

      if (database === "TVDB") {
        const selectedTvdbSearchResult = result as TVDBv4SearchResult
        return applyTvdbTvShowSelectionMutation.mutateAsync({
          seriesId: Number(selectedTvdbSearchResult.tvdb_id),
          language: searchLanguage,
          mediaFolderPath,
          traceId,
        })
      }
      return applyTmdbTvShowSelectionMutation.mutateAsync({
        id: result.id,
        language: searchLanguage,
        mediaFolderPath,
        traceId,
      })
    },
    [applyTmdbTvShowSelectionMutation, applyTvdbTvShowSelectionMutation],
  )

  const mutate = useCallback(
    (variables: SelectTvShowForFolderVariables) => {
      if (isSmmV3Enabled()) {
        recognizeFolderMutation.mutate(variables)
        return
      }
      mutateLegacy(variables)
    },
    [mutateLegacy, recognizeFolderMutation],
  )

  const mutateAsync = useCallback(
    async (variables: SelectTvShowForFolderVariables) => {
      if (isSmmV3Enabled()) {
        await recognizeFolderMutation.mutateAsync(variables)
        return
      }
      return mutateAsyncLegacy(variables)
    },
    [mutateAsyncLegacy, recognizeFolderMutation],
  )

  const selectTvShowForFolderMutation = useMemo(
    () => ({ mutate, mutateAsync }),
    [mutate, mutateAsync],
  )

  const isSelectTvShowForFolderPending =
    recognizeFolderMutation.isPending ||
    applyTmdbTvShowSelectionMutation.isPending ||
    applyTvdbTvShowSelectionMutation.isPending

  return {
    selectTvShowForFolderMutation,
    isSelectTvShowForFolderPending,
    updateMediaMetadata,
  }
}
