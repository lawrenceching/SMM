import { useQueryClient } from "@tanstack/react-query"
import { createContext, createElement, useCallback, useContext, type ReactNode } from "react"
import {
  getMovieById as fetchMovieByIdHttp,
  getTvShowById as fetchTvShowByIdHttp,
  getSeason as fetchTvShowSeasonHttp,
  searchTmdb,
  SMM_TMDB_DEFAULT_UPSTREAM,
  type TmdbRequestOptions,
} from "@/api/tmdb"
import { tmdbMovieByIdQueryKey, tmdbTvShowByIdQueryKey, tmdbTvShowSeasonQueryKey } from "@/lib/tmdbQueryKeys"
import type {
  HelloResponseBody,
  TmdbMovieDetails,
  TmdbSearchResponseBody,
  TmdbSeriesDetails,
  TmdbSeasonDetails,
} from "@core/types"
import { delay } from "es-toolkit"
import { helloQueryKey } from "@/lib/appQueryKeys"
import { useConfig } from "./userConfig"

const TMDB_TV_SHOW_BY_ID_STALE_MS = 5 * 60 * 1000
const TMDB_TV_SHOW_SEASON_STALE_MS = 5 * 60 * 1000
const TMDB_MOVIE_BY_ID_STALE_MS = 5 * 60 * 1000

const delayInMs = parseInt(localStorage.getItem('debug_http_delay_ms') ?? "0");

export interface TmdbQueriesRuntimeOptions {
  fetchFn?: typeof fetch
}

const TmdbQueriesRuntimeContext = createContext<TmdbQueriesRuntimeOptions>({})

/** Test-only hook: inject a custom fetch implementation for TMDB HTTP calls. */
export function TmdbQueriesRuntimeProvider({
  fetchFn,
  children,
}: {
  fetchFn?: typeof fetch
  children: ReactNode
}) {
  return createElement(
    TmdbQueriesRuntimeContext.Provider,
    { value: { fetchFn } },
    children,
  )
}

export function useTmdbQueries() {
  const queryClient = useQueryClient()
  const runtime = useContext(TmdbQueriesRuntimeContext)
  const { appConfig, userConfig } = useConfig()
  const reverseProxyFromConfig = appConfig?.reverseProxyUrl ?? null

  const tmdbCacheScope = (options?: TmdbRequestOptions) => ({
    upstreamBaseURL: options?.upstreamBaseURL?.trim() ?? "",
    hasTmdbApiKey: Boolean(options?.apiKey?.trim()),
  })

  const getReverseProxyUrl = (): string | null | undefined =>
    reverseProxyFromConfig ??
    queryClient.getQueryData<HelloResponseBody>(helloQueryKey)?.reverseProxyUrl

  const getDefaultTmdbRequestOptions = (): TmdbRequestOptions => ({
    reverseProxyUrl: getReverseProxyUrl(),
    upstreamBaseURL: userConfig.tmdb?.host?.trim() || SMM_TMDB_DEFAULT_UPSTREAM,
    apiKey: userConfig.tmdb?.apiKey?.trim() || undefined,
  })

  const withReverseProxyUrl = (options?: TmdbRequestOptions): TmdbRequestOptions => ({
    ...getDefaultTmdbRequestOptions(),
    ...options,
    reverseProxyUrl: options?.reverseProxyUrl ?? getDefaultTmdbRequestOptions().reverseProxyUrl,
    fetchFn: options?.fetchFn ?? runtime.fetchFn,
  })

  const getTvShowById = useCallback(
    async (
      id: number,
      language?: string,
      options?: TmdbRequestOptions
    ): Promise<TmdbSeriesDetails> => {
      if (delayInMs > 0) {
        await delay(delayInMs)
      }
      const resolvedOptions = withReverseProxyUrl(options)
      return queryClient.fetchQuery({
        queryKey: [...tmdbTvShowByIdQueryKey(id, language), tmdbCacheScope(options)],
        queryFn: () => fetchTvShowByIdHttp(id, language, resolvedOptions),
        staleTime: TMDB_TV_SHOW_BY_ID_STALE_MS,
      })
    },
    [queryClient, reverseProxyFromConfig, userConfig.tmdb?.host, userConfig.tmdb?.apiKey, runtime.fetchFn]
  )

  const getTvShowSeasonDetails = useCallback(
    async (
      seriesId: number,
      seasonNumber: number,
      language?: string,
      options?: {
        upstreamBaseURL?: string;
        apiKey?: string;
        appendToResponse?: string;
        signal?: AbortSignal;
      }
    ): Promise<TmdbSeasonDetails> => {
      if (delayInMs > 0) {
        await delay(delayInMs)
      }
      const resolvedOptions = withReverseProxyUrl(options)
      return queryClient.fetchQuery({
        queryKey: [
          ...tmdbTvShowSeasonQueryKey(seriesId, seasonNumber, language),
          tmdbCacheScope(options),
        ],
        queryFn: () => fetchTvShowSeasonHttp(seriesId, seasonNumber, language, resolvedOptions),
        staleTime: TMDB_TV_SHOW_SEASON_STALE_MS,
      })
    },
    [queryClient, reverseProxyFromConfig, userConfig.tmdb?.host, userConfig.tmdb?.apiKey, runtime.fetchFn]
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
      const resolvedOptions = withReverseProxyUrl(options)
      return queryClient.fetchQuery({
        queryKey: [...tmdbMovieByIdQueryKey(id, language), tmdbCacheScope(options)],
        queryFn: () => fetchMovieByIdHttp(id, language, resolvedOptions),
        staleTime: TMDB_MOVIE_BY_ID_STALE_MS,
      })
    },
    [queryClient, reverseProxyFromConfig, userConfig.tmdb?.host, userConfig.tmdb?.apiKey, runtime.fetchFn]
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
      const resolvedOptions = withReverseProxyUrl(options)
      return queryClient.fetchQuery({
        queryKey: ["tmdb-search", query, type, language, tmdbCacheScope(options)],
        queryFn: () => searchTmdb(query, type, language, resolvedOptions),
      })
    },
    [queryClient, reverseProxyFromConfig, userConfig.tmdb?.host, userConfig.tmdb?.apiKey, runtime.fetchFn]
  )

  return { getTvShowById, getTvShowSeasonDetails, getMovieById, search}
}
