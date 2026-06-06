import { useCallback, useMemo } from "react"
import { useFetchMediaMetadataMutation } from "@/hooks/mediaMetadata/useFetchMediaMetadataMutation"
import { useUpdateMediaMetadataMutation } from "@/hooks/mediaMetadata/useUpdateMediaMetadataMutation"
import { normalizeMediaFolderPathForQuery } from "@/lib/mediaMetadataQueryKeys"
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore"
import type { MediaMetadata, MovieMediaMetadata, TMDBMovie, TMDBTVShow } from "@core/types"
import { useGetTmdbMovieMutation } from "@/hooks/useGetTmdbMovieMutation"
import { useGetTvdbMovieMutation } from "@/hooks/useGetTvdbMovieMutation"
import { nextTraceId } from "@/lib/utils"
import { toast } from "sonner"
import type { SearchLanguage } from "@/components/MediaDatabaseSearchbox"
import type { TVDBSearchItem } from "@/lib/tvdbSearchNormalize"

type ApplyMovieSelectionShared = {
  mediaFolderPath: string
  traceId: string
  baseMetadata: MediaMetadata
}

type ApplyTmdbMovieSelectionVars = ApplyMovieSelectionShared & {
  id: number
  language?: string
}

type ApplyTvdbMovieSelectionVars = ApplyMovieSelectionShared & {
  movieId: number
  language?: string
}

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

export function useSelectMovieForFolderMutation() {
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

  const onMutate = useCallback(
    (variables: ApplyMovieSelectionShared) => {
      useUIMediaFolderStore.getState().updateFolderStatus(variables.mediaFolderPath, "loading")
      void updateMediaMetadata(variables.mediaFolderPath, { ...variables.baseMetadata }, {
        traceId: variables.traceId,
      })
    },
    [updateMediaMetadata],
  )

  const onSuccess = useCallback(
    (movie: MovieMediaMetadata, variables: ApplyMovieSelectionShared) => {
      void updateMediaMetadata(
        variables.mediaFolderPath,
        (prev) => ({
          ...prev,
          movie,
        }),
        { traceId: variables.traceId },
      )
    },
    [updateMediaMetadata],
  )

  const onTmdbError = useCallback((error: Error, _variables: ApplyTmdbMovieSelectionVars) => {
    console.error("Failed to get TMDB movie:", error)
    toast.error(`Unable to fetch data from TMDB: ${error.message}`)
  }, [])

  const onTvdbError = useCallback((error: Error, _variables: ApplyTvdbMovieSelectionVars) => {
    console.error("Failed to get TVDB movie:", error)
    toast.error(`Unable to fetch data from TVDB: ${error.message}`)
  }, [])

  const applyTmdbMovieSelectionMutation = useGetTmdbMovieMutation<ApplyTmdbMovieSelectionVars>({
    onMutate,
    onSuccess,
    onError: onTmdbError,
  })

  const applyTvdbMovieSelectionMutation = useGetTvdbMovieMutation<ApplyTvdbMovieSelectionVars>({
    onMutate,
    onSuccess,
    onError: onTvdbError,
  })

  const mutate = useCallback(
    (variables: SelectMovieForFolderVariables) => {
      const { database, result, searchLanguage, mediaFolderPath, baseMetadata } = variables
      const traceId = `MovieSearchResultSelected-${nextTraceId()}`

      if (database === "TVDB") {
        applyTvdbMovieSelectionMutation.mutate({
          movieId: parseInt(String(result.tvdb_id), 10),
          language: searchLanguage,
          mediaFolderPath,
          traceId,
          baseMetadata,
        })
      } else {
        applyTmdbMovieSelectionMutation.mutate({
          id: parseInt(String(result.id), 10),
          language: searchLanguage,
          mediaFolderPath,
          traceId,
          baseMetadata,
        })
      }
    },
    [applyTmdbMovieSelectionMutation, applyTvdbMovieSelectionMutation],
  )

  const mutateAsync = useCallback(
    async (variables: SelectMovieForFolderVariables) => {
      const { database, result, searchLanguage, mediaFolderPath, baseMetadata } = variables
      const traceId = `MovieSearchResultSelected-${nextTraceId()}`

      if (database === "TVDB") {
        return applyTvdbMovieSelectionMutation.mutateAsync({
          movieId: parseInt(String(result.tvdb_id), 10),
          language: searchLanguage,
          mediaFolderPath,
          traceId,
          baseMetadata,
        })
      }
      return applyTmdbMovieSelectionMutation.mutateAsync({
        id: parseInt(String(result.id), 10),
        language: searchLanguage,
        mediaFolderPath,
        traceId,
        baseMetadata,
      })
    },
    [applyTmdbMovieSelectionMutation, applyTvdbMovieSelectionMutation],
  )

  const selectMovieForFolderMutation = useMemo(
    () => ({ mutate, mutateAsync }),
    [mutate, mutateAsync],
  )

  const isSelectMovieForFolderPending =
    applyTmdbMovieSelectionMutation.isPending || applyTvdbMovieSelectionMutation.isPending

  return {
    selectMovieForFolderMutation,
    isSelectMovieForFolderPending,
  }
}
