import { useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { getTvShowById as fetchTvShowByIdHttp } from "@/api/tmdb"
import { tmdbTvShowByIdQueryKey } from "@/lib/tmdbQueryKeys"
import type { PreferMediaLanguage, TmdbTvShowResponseBody } from "@core/types"

const TMDB_TV_SHOW_BY_ID_STALE_MS = 5 * 60 * 1000

export function useTmdbQueries() {
  const queryClient = useQueryClient()

  const getTvShowById = useCallback(
    (id: number, language?: PreferMediaLanguage): Promise<TmdbTvShowResponseBody> =>
      queryClient.fetchQuery({
        queryKey: tmdbTvShowByIdQueryKey(id, language),
        queryFn: () => fetchTvShowByIdHttp(id, language),
        staleTime: TMDB_TV_SHOW_BY_ID_STALE_MS,
      }),
    [queryClient]
  )

  return { getTvShowById }
}
