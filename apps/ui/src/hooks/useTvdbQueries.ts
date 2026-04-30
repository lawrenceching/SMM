import { useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { fetchTvdbAndBuildMovieMediaMetadata, fetchTvdbAndBuildTvShowMediaMetadata, getTVDBv4Client } from "@/lib/TvdbUtils"
import {
  tvdbArtworkTypesQueryKey,
  tvdbMovieExtendedQueryKey,
  tvdbMovieMediaMetadataQueryKey,
  tvdbSearchQueryKey,
  tvdbSeriesExtendedQueryKey,
  tvdbSeasonExtendedQueryKey,
  tvdbTvShowMediaMetadataQueryKey,
} from "@/lib/tvdbQueryKeys"
import type { HelloResponseBody, MovieMediaMetadata, PreferMediaLanguage, TvShowMediaMetadata } from "@core/types"
import type { TVDBv4SearchParams } from "@smm/tvdb4"
import type {
  TVDBv4ArtworkTypeRecord,
  TVDBv4MovieBaseRecord,
  TVDBv4SearchResult,
  TVDBv4SeriesExtendedResponse,
  TVDBv4SeriesSeasonsExtendedResponse,
} from "@smm/tvdb4/types"
import { helloQueryKey } from "@/lib/appQueryKeys"

const TVDB_ARTWORK_TYPES_STALE_MS = 24 * 60 * 60 * 1000
const TVDB_SERIES_EXTENDED_STALE_MS = 5 * 60 * 1000
const TVDB_MOVIE_EXTENDED_STALE_MS = 5 * 60 * 1000
const TVDB_SEASON_EXTENDED_STALE_MS = 5 * 60 * 1000
const TVDB_TV_SHOW_MEDIA_METADATA_STALE_MS = 5 * 60 * 1000
const TVDB_MOVIE_MEDIA_METADATA_STALE_MS = 5 * 60 * 1000
const TVDB_SEARCH_STALE_MS = 2 * 60 * 1000

export function useTvdbQueries() {
  const queryClient = useQueryClient()

  const getReverseProxyUrl = (): string | null | undefined => {
    const helloData = queryClient.getQueryData<HelloResponseBody>(helloQueryKey)
    return helloData?.reverseProxyUrl
  }

  const getArtworkTypes = useCallback(
    (): Promise<TVDBv4ArtworkTypeRecord[] | undefined> => {
      const tvdb = getTVDBv4Client(getReverseProxyUrl())
      return queryClient.fetchQuery({
        queryKey: tvdbArtworkTypesQueryKey(),
        queryFn: async () => {
          const resp = await tvdb.getArtworkTypes()
          return resp.status === "success" ? resp.data : undefined
        },
        staleTime: TVDB_ARTWORK_TYPES_STALE_MS,
      })
    },
    [queryClient]
  )

  const getSeriesExtended = useCallback(
    (seriesId: number): Promise<TVDBv4SeriesExtendedResponse | undefined> => {
      const tvdb = getTVDBv4Client(getReverseProxyUrl())
      return queryClient.fetchQuery({
        queryKey: tvdbSeriesExtendedQueryKey(seriesId),
        queryFn: async () => {
          const resp = await tvdb.getSeriesExtended(seriesId)
          return resp.status === "success" ? resp.data : undefined
        },
        staleTime: TVDB_SERIES_EXTENDED_STALE_MS,
      })
    },
    [queryClient]
  )

  const getSeasonExtended = useCallback(
    (seasonId: number): Promise<TVDBv4SeriesSeasonsExtendedResponse | undefined> => {
      const tvdb = getTVDBv4Client(getReverseProxyUrl())
      return queryClient.fetchQuery({
        queryKey: tvdbSeasonExtendedQueryKey(seasonId),
        queryFn: async () => {
          const resp = await tvdb.getSeasonExtendedById(seasonId)
          return resp.status === "success" ? resp.data : undefined
        },
        staleTime: TVDB_SEASON_EXTENDED_STALE_MS,
      })
    },
    [queryClient]
  )

  const getMovieExtended = useCallback(
    (movieId: number): Promise<TVDBv4MovieBaseRecord | undefined> => {
      const tvdb = getTVDBv4Client(getReverseProxyUrl())
      return queryClient.fetchQuery({
        queryKey: tvdbMovieExtendedQueryKey(movieId),
        queryFn: async () => {
          const resp = await tvdb.getMovieExtended(movieId)
          return resp.status === "success" ? resp.data : undefined
        },
        staleTime: TVDB_MOVIE_EXTENDED_STALE_MS,
      })
    },
    [queryClient]
  )

  const search = useCallback(
    (params: TVDBv4SearchParams): Promise<TVDBv4SearchResult[] | undefined> => {
      const tvdb = getTVDBv4Client(getReverseProxyUrl())
      return queryClient.fetchQuery({
        queryKey: tvdbSearchQueryKey(params),
        queryFn: async () => {
          const resp = await tvdb.search(params)
          return resp.status === "success" ? resp.data : undefined
        },
        staleTime: TVDB_SEARCH_STALE_MS,
      })
    },
    [queryClient]
  )

  const getTvShowMediaMetadata = useCallback(
    (
      seriesId: number,
      language?: PreferMediaLanguage
    ): Promise<TvShowMediaMetadata> => {
      const lang = language ?? "en-US"
      return queryClient.fetchQuery({
        queryKey: tvdbTvShowMediaMetadataQueryKey(seriesId, lang),
        queryFn: async () => {
          const metadata = await fetchTvdbAndBuildTvShowMediaMetadata(
            seriesId,
            lang,
            {},
            getReverseProxyUrl(),
          )
          if (metadata === undefined) {
            throw new Error(`Failed to fetch TVDB series ${seriesId}`)
          }
          return metadata
        },
        staleTime: TVDB_TV_SHOW_MEDIA_METADATA_STALE_MS,
      })
    },
    [queryClient]
  )

  const getMovieMediaMetadata = useCallback(
    (movieId: number, language?: PreferMediaLanguage): Promise<MovieMediaMetadata> => {
      const lang = language ?? "en-US"
      return queryClient.fetchQuery({
        queryKey: tvdbMovieMediaMetadataQueryKey(movieId, lang),
        queryFn: async () => {
          const metadata = await fetchTvdbAndBuildMovieMediaMetadata(movieId, lang, {}, getReverseProxyUrl())
          if (metadata === undefined) {
            throw new Error(`Failed to fetch TVDB movie ${movieId}`)
          }
          return metadata
        },
        staleTime: TVDB_MOVIE_MEDIA_METADATA_STALE_MS,
      })
    },
    [queryClient]
  )

  return {
    getArtworkTypes,
    getSeriesExtended,
    getMovieExtended,
    getSeasonExtended,
    search,
    getTvShowMediaMetadata,
    getMovieMediaMetadata,
  }
}
