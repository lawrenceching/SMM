import { useMutation, type UseMutationOptions } from "@tanstack/react-query"
import { useTvdbQueries } from "@/hooks/useTvdbQueries"
import type { PreferMediaLanguage, TvShowMediaMetadata } from "@core/types"

/**
 * Fetches TVDB TV details via cached HTTP (`fetchQuery`) and maps to {@link TvShowMediaMetadata}.
 * Pass `onMutate` / `onSuccess` / `onError` (and optional `meta` via variables) for component-specific UI updates.
 */
export function useGetTvdbTvShowMutation<
  TVariables extends { seriesId: number; language?: PreferMediaLanguage },
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<TvShowMediaMetadata, Error, TVariables, TContext>,
    "mutationFn"
  >
) {
  const { getTvShowMediaMetadata } = useTvdbQueries()

  return useMutation({
    ...options,
    mutationFn: async (variables: TVariables) =>
      getTvShowMediaMetadata(variables.seriesId, variables.language),
  })
}
