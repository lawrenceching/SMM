import { useMutation, type UseMutationOptions } from "@tanstack/react-query"
import { useTmdbQueries } from "@/hooks/useTmdbQueries"
import type { MovieMediaMetadata, TmdbMovieDetails } from "@core/types"
import type { TmdbRequestOptions } from "@/api/tmdb"

/**
 * Fetches TMDB movie details via cached HTTP (`fetchQuery`) and maps to {@link MovieMediaMetadata}.
 * Pass `onMutate` / `onSuccess` / `onError` (and optional `meta` via variables) for component-specific UI updates.
 */
export function useGetTmdbMovieMutation<
  TVariables extends { id: number; language?: string; tmdb?: TmdbRequestOptions },
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<MovieMediaMetadata, Error, TVariables, TContext>,
    "mutationFn"
  >
) {
  const { getMovieById } = useTmdbQueries()

  return useMutation({
    ...options,
    mutationFn: async (variables: TVariables) => {
      console.log(`useGetTmdbMovieMutation CALLED`, { ...variables })
      const details: TmdbMovieDetails = await getMovieById(
        variables.id,
        variables.language,
        variables.tmdb
      )
      return buildMovieMediaMetadata(details)
    },
  })
}

export function buildMovieMediaMetadata(tmdbMovieDetails: TmdbMovieDetails): MovieMediaMetadata {
  const name =
    (tmdbMovieDetails.title && tmdbMovieDetails.title.trim().length > 0
      ? tmdbMovieDetails.title
      : tmdbMovieDetails.original_title) ?? ""

  return {
    id: String(tmdbMovieDetails.id),
    name,
    airDate: tmdbMovieDetails.release_date,
    database: "TMDB",
  }
}
