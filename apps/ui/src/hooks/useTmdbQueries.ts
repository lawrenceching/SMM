import { useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import {
  getMovieById as fetchMovieByIdHttp,
  getTvShowById as fetchTvShowByIdHttp,
  getSeason as fetchTvShowSeasonHttp,
  searchTmdb,
  type TmdbRequestOptions,
} from "@/api/tmdb"
import { tmdbMovieByIdQueryKey, tmdbTvShowByIdQueryKey, tmdbTvShowSeasonQueryKey } from "@/lib/tmdbQueryKeys"
import type {
  TmdbMovieDetails,
  TmdbSearchResponseBody,
  TmdbSeriesDetails,
  TmdbSeasonDetails,
} from "@core/types"
import { delay } from "es-toolkit"

const TMDB_TV_SHOW_BY_ID_STALE_MS = 5 * 60 * 1000
const TMDB_TV_SHOW_SEASON_STALE_MS = 5 * 60 * 1000
const TMDB_MOVIE_BY_ID_STALE_MS = 5 * 60 * 1000

const delayInMs = parseInt(localStorage.getItem('debug_http_delay_ms') ?? "0");

export function useTmdbQueries() {
  const queryClient = useQueryClient()

  const getTvShowById = useCallback(
    async (
      id: number,
      language?: string,
      options?: TmdbRequestOptions
    ): Promise<TmdbSeriesDetails> => {
      if (delayInMs > 0) {
        await delay(delayInMs)
      }
      return queryClient.fetchQuery({
        queryKey: tmdbTvShowByIdQueryKey(id, language),
        queryFn: () => fetchTvShowByIdHttp(id, language, options),
        staleTime: TMDB_TV_SHOW_BY_ID_STALE_MS,
      })
    },
    [queryClient]
  )

  const getTvShowSeasonDetails = useCallback(
    async (
      seriesId: number,
      seasonNumber: number,
      language?: string,
      options?: TmdbRequestOptions
    ): Promise<TmdbSeasonDetails> => {
      if (delayInMs > 0) {
        await delay(delayInMs)
      }
      return queryClient.fetchQuery({
        queryKey: tmdbTvShowSeasonQueryKey(seriesId, seasonNumber, language),
        queryFn: () => fetchTvShowSeasonHttp(seriesId, seasonNumber, language, options),
        staleTime: TMDB_TV_SHOW_SEASON_STALE_MS,
      })
    },
    [queryClient]
  )

  const getMovieById = useCallback(
    async (
      id: number,
      language?: string,
      options?: TmdbRequestOptions
    ): Promise<TmdbMovieDetails> => {
      if (delayInMs > 0) {
        await delay(delayInMs)
      }
      return queryClient.fetchQuery({
        queryKey: tmdbMovieByIdQueryKey(id, language),
        queryFn: () => fetchMovieByIdHttp(id, language, options),
        staleTime: TMDB_MOVIE_BY_ID_STALE_MS,
      })
    },
    [queryClient]
  )

  const search = useCallback(
    async (
      query: string,
      type: "tv" | "movie",
      language: string,
      options?: TmdbRequestOptions
    ): Promise<TmdbSearchResponseBody> => {
      if (delayInMs > 0) {
        await delay(delayInMs)
      }
      return queryClient.fetchQuery({
        queryKey: ["tmdb-search", query, type, language],
        queryFn: () => searchTmdb(query, type, language, options),
      })
    },
    [queryClient]
  )

  return { getTvShowById, getTvShowSeasonDetails, getMovieById, search}
}
