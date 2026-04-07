import { useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { fetchTvdbAndBuildTvShowMediaMetadata, getTVDBv4Client } from "@/lib/TvdbUtils"
import {
  tvdbArtworkTypesQueryKey,
  tvdbSearchQueryKey,
  tvdbSeriesExtendedQueryKey,
  tvdbSeasonExtendedQueryKey,
  tvdbTvShowMediaMetadataQueryKey,
} from "@/lib/tvdbQueryKeys"
import type { PreferMediaLanguage, TvShowMediaMetadata } from "@core/types"
import type { TVDBv4SearchParams } from "@smm/tvdb4"
import type {
  TVDBv4ArtworkTypeRecord,
  TVDBv4SearchResult,
  TVDBv4SeriesExtendedResponse,
  TVDBv4SeriesSeasonsExtendedResponse,
} from "@smm/tvdb4/types"

const TVDB_ARTWORK_TYPES_STALE_MS = 24 * 60 * 60 * 1000
const TVDB_SERIES_EXTENDED_STALE_MS = 5 * 60 * 1000
const TVDB_SEASON_EXTENDED_STALE_MS = 5 * 60 * 1000
const TVDB_TV_SHOW_MEDIA_METADATA_STALE_MS = 5 * 60 * 1000
const TVDB_SEARCH_STALE_MS = 2 * 60 * 1000

export function useTvdbQueries() {
  const queryClient = useQueryClient()

  const getArtworkTypes = useCallback(
    (): Promise<TVDBv4ArtworkTypeRecord[] | undefined> => {
      const tvdb = getTVDBv4Client()
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
      const tvdb = getTVDBv4Client()
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
      const tvdb = getTVDBv4Client()
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

  const search = useCallback(
    (params: TVDBv4SearchParams): Promise<TVDBv4SearchResult[] | undefined> => {
      const tvdb = getTVDBv4Client()
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
            {}
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

  return {
    getArtworkTypes,
    getSeriesExtended,
    getSeasonExtended,
    search,
    getTvShowMediaMetadata,
  }
}
