import { useCallback, useMemo } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useFetchMediaMetadataMutation } from "@/hooks/mediaMetadata/useFetchMediaMetadataMutation"
import { useUpdateMediaMetadataMutation } from "@/hooks/mediaMetadata/useUpdateMediaMetadataMutation"
import { normalizeMediaFolderPathForQuery, mediaMetadataQueryKey } from "@/lib/mediaMetadataQueryKeys"
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore"
import type { MediaMetadata, MovieMediaMetadata, TMDBMovie, TMDBTVShow } from "@smm/types"
import { useGetTmdbMovieMutation } from "@/hooks/useGetTmdbMovieMutation"
import { useGetTvdbMovieMutation } from "@/hooks/useGetTvdbMovieMutation"
import { recognizeFolderViaCore } from "@/api/recognizeFolder"
import { isSmmV3Enabled } from "@/lib/localStorages"
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

  const onMutateLegacy = useCallback(
    (variables: ApplyMovieSelectionShared) => {
      useUIMediaFolderStore.getState().updateFolderStatus(variables.mediaFolderPath, "loading")
      void updateMediaMetadata(variables.mediaFolderPath, { ...variables.baseMetadata }, {
        traceId: variables.traceId,
      })
    },
    [updateMediaMetadata],
  )

  const onSuccessLegacy = useCallback(
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
    onMutate: onMutateLegacy,
    onSuccess: onSuccessLegacy,
    onError: onTmdbError,
  })

  const applyTvdbMovieSelectionMutation = useGetTvdbMovieMutation<ApplyTvdbMovieSelectionVars>({
    onMutate: onMutateLegacy,
    onSuccess: onSuccessLegacy,
    onError: onTvdbError,
  })

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

  const mutateLegacy = useCallback(
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

  const mutateAsyncLegacy = useCallback(
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

  const mutate = useCallback(
    (variables: SelectMovieForFolderVariables) => {
      if (isSmmV3Enabled()) {
        recognizeFolderMutation.mutate(variables)
        return
      }
      mutateLegacy(variables)
    },
    [mutateLegacy, recognizeFolderMutation],
  )

  const mutateAsync = useCallback(
    async (variables: SelectMovieForFolderVariables) => {
      if (isSmmV3Enabled()) {
        await recognizeFolderMutation.mutateAsync(variables)
        return
      }
      return mutateAsyncLegacy(variables)
    },
    [mutateAsyncLegacy, recognizeFolderMutation],
  )

  const selectMovieForFolderMutation = useMemo(
    () => ({ mutate, mutateAsync }),
    [mutate, mutateAsync],
  )

  const isSelectMovieForFolderPending =
    recognizeFolderMutation.isPending ||
    applyTmdbMovieSelectionMutation.isPending ||
    applyTvdbMovieSelectionMutation.isPending

  return {
    selectMovieForFolderMutation,
    isSelectMovieForFolderPending,
  }
}
