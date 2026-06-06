import { useCallback, useMemo } from "react"
import { useFetchMediaMetadataMutation } from "@/hooks/mediaMetadata/useFetchMediaMetadataMutation"
import { useUpdateMediaMetadataMutation } from "@/hooks/mediaMetadata/useUpdateMediaMetadataMutation"
import { normalizeMediaFolderPathForQuery } from "@/lib/mediaMetadataQueryKeys"
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore"
import { Path } from "@core/path"
import type { MediaMetadata, TMDBMovie, TMDBTVShow, TvShowMediaMetadata } from "@core/types"
import { useGetTmdbTvShowMutation } from "@/hooks/useGetTmdbTvShowMutation"
import { useGetTvdbTvShowMutation } from "@/hooks/useGetTvdbTvShowMutation"
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

export function useSelectTvShowForFolderMutation() {
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

  /** Write media metadata via TanStack Query + Zustand (recognize + rename plans). */
  const persistUiMediaMetadata = useCallback(
    async (path: string, metadata: MediaMetadata, options?: { traceId?: string }) => {
      const pathPosix = normalizeMediaFolderPathForQuery(path)
      await updateMediaMetadataMutation.mutateAsync({
        pathPosix,
        metadata,
        traceId: options?.traceId,
      })
    },
    [updateMediaMetadataMutation],
  )

  const setFolderStatus = useUIMediaFolderStore.getState().updateFolderStatus

  const onMutate = useCallback(
    (variables: { mediaFolderPath: string }) => {
      setFolderStatus(Path.toPlatformPath(variables.mediaFolderPath), "loading")
      void updateMediaMetadata(variables.mediaFolderPath, (prev) => ({
        ...prev,
        tvShow: undefined,
      }))
    },
    [setFolderStatus, updateMediaMetadata],
  )

  const onSuccess = useCallback(
    (tvShow: TvShowMediaMetadata, variables: { mediaFolderPath: string }) => {
      void updateMediaMetadata(variables.mediaFolderPath, (prev) => ({
        ...prev,
        tvShow,
      }))
      setFolderStatus(Path.toPlatformPath(variables.mediaFolderPath), "ok")
    },
    [setFolderStatus, updateMediaMetadata],
  )

  const onError = useCallback((error: Error, variables: { mediaFolderPath: string }) => {
    toast.error(error instanceof Error ? error.message : "Failed to get TV show details")
    setFolderStatus(Path.toPlatformPath(variables.mediaFolderPath), "ok")
  }, [setFolderStatus])

  const applyTmdbTvShowSelectionMutation = useGetTmdbTvShowMutation<ApplyTmdbTvShowSelectionVars>({
    onMutate,
    onSuccess,
    onError,
  })

  const applyTvdbTvShowSelectionMutation = useGetTvdbTvShowMutation<ApplyTvdbTvShowSelectionVars>({
    onMutate,
    onSuccess,
    onError,
  })

  const mutate = useCallback(
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

  const mutateAsync = useCallback(
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

  const selectTvShowForFolderMutation = useMemo(
    () => ({ mutate, mutateAsync }),
    [mutate, mutateAsync],
  )

  const isSelectTvShowForFolderPending =
    applyTmdbTvShowSelectionMutation.isPending || applyTvdbTvShowSelectionMutation.isPending

  return {
    selectTvShowForFolderMutation,
    isSelectTvShowForFolderPending,
    updateMediaMetadata,
    persistUiMediaMetadata,
  }
}
