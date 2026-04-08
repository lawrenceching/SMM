import { useMutation, type UseMutationOptions } from "@tanstack/react-query"
import { useTvdbQueries } from "@/hooks/useTvdbQueries"
import type { MovieMediaMetadata, PreferMediaLanguage } from "@core/types"

/**
 * Fetches TVDB movie details via cached HTTP (`fetchQuery`) and maps to {@link MovieMediaMetadata}.
 * Pass `onMutate` / `onSuccess` / `onError` (and optional `meta` via variables) for component-specific UI updates.
 */
export function useGetTvdbMovieMutation<
  TVariables extends { movieId: number; language?: PreferMediaLanguage },
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<MovieMediaMetadata, Error, TVariables, TContext>,
    "mutationFn"
  >
) {
  const { getMovieMediaMetadata } = useTvdbQueries()

  return useMutation({
    ...options,
    mutationFn: async (variables: TVariables) =>
      getMovieMediaMetadata(variables.movieId, variables.language),
  })
}
