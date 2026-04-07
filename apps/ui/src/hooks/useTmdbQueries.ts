import { useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { getTvShowById as fetchTvShowByIdHttp, getSeason as fetchTvShowSeasonHttp } from "@/api/tmdb"
import { tmdbTvShowByIdQueryKey, tmdbTvShowSeasonQueryKey } from "@/lib/tmdbQueryKeys"
import type { PreferMediaLanguage, TmdbSeriesDetails, TmdbSeasonDetails } from "@core/types"

const TMDB_TV_SHOW_BY_ID_STALE_MS = 5 * 60 * 1000
const TMDB_TV_SHOW_SEASON_STALE_MS = 5 * 60 * 1000

export function useTmdbQueries() {
  const queryClient = useQueryClient()

  const getTvShowById = useCallback(
    (id: number, language?: PreferMediaLanguage): Promise<TmdbSeriesDetails> =>
      queryClient.fetchQuery({
        queryKey: tmdbTvShowByIdQueryKey(id, language),
        queryFn: () => fetchTvShowByIdHttp(id, language),
        staleTime: TMDB_TV_SHOW_BY_ID_STALE_MS,
      }),
    [queryClient]
  )

  const getTvShowSeasonDetails = useCallback(
    (
      seriesId: number,
      seasonNumber: number,
      language?: PreferMediaLanguage,
      options?: {
        baseURL?: string;
        appendToResponse?: string;
        signal?: AbortSignal;
      }
    ): Promise<TmdbSeasonDetails> =>
      queryClient.fetchQuery({
        queryKey: tmdbTvShowSeasonQueryKey(seriesId, seasonNumber, language),
        queryFn: () => fetchTvShowSeasonHttp(seriesId, seasonNumber, language, options),
        staleTime: TMDB_TV_SHOW_SEASON_STALE_MS,
      }),
    [queryClient]
  )

  return { getTvShowById, getTvShowSeasonDetails }
}
