import { useMutation, type UseMutationOptions } from "@tanstack/react-query"
import { tvShowMediaMetadataFromTmdbTvShowResponse } from "@/lib/TmdbUtils"
import { useTmdbQueries } from "@/hooks/useTmdbQueries"
import type { PreferMediaLanguage, TvShowMediaMetadata } from "@core/types"

/**
 * Fetches TMDB TV details via cached HTTP (`fetchQuery`) and maps to {@link TvShowMediaMetadata}.
 * Pass `onMutate` / `onSuccess` / `onError` (and optional `meta` via variables) for component-specific UI updates.
 */
export function useGetTmdbTvShowMutation<
  TVariables extends { id: number; language?: PreferMediaLanguage },
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<TvShowMediaMetadata, Error, TVariables, TContext>,
    "mutationFn"
  >
) {
  const { getTvShowById } = useTmdbQueries()

  return useMutation({
    ...options,
    mutationFn: async (variables: TVariables) => {
      const resp = await getTvShowById(variables.id, variables.language)
      return tvShowMediaMetadataFromTmdbTvShowResponse(resp, variables.id)
    },
  })
}
