import { useQuery } from "@tanstack/react-query"
import { useTmdbQueries } from "@/hooks/useTmdbQueries"
import { useTvdbQueries } from "@/hooks/useTvdbQueries"
import { useConfig } from "@/hooks/userConfig"
import {
  isInternalDatabaseCheckError,
  mapQueryStatus,
  type DatabaseConnectionStatus,
} from "@/lib/databaseConnectionCheck"

export type { DatabaseConnectionStatus }

const DATABASE_CONNECTION_CHECK_INTERVAL_MS = 60 * 1000
const DATABASE_CONNECTION_STALE_MS = 50 * 1000

export interface UseDatabaseConnectionStatusResult {
  tmdbStatus: DatabaseConnectionStatus
  tvdbStatus: DatabaseConnectionStatus
  hasWarning: boolean
}

export function useDatabaseConnectionStatus(): UseDatabaseConnectionStatusResult {
  const { appConfig } = useConfig()
  const reverseProxyUrl = appConfig.reverseProxyUrl?.trim() ?? ""
  const isCheckEnabled = reverseProxyUrl.length > 0

  const { getTvShowById } = useTmdbQueries()
  const { getArtworkTypes } = useTvdbQueries()

  const tmdbQuery = useQuery({
    queryKey: ["database-connection-check", "tmdb", reverseProxyUrl],
    enabled: isCheckEnabled,
    queryFn: async () => {
      try {
        await getTvShowById(1)
        return true
      } catch (err) {
        if (isInternalDatabaseCheckError(err)) {
          throw err
        }
        return false
      }
    },
    staleTime: DATABASE_CONNECTION_STALE_MS,
    refetchInterval: DATABASE_CONNECTION_CHECK_INTERVAL_MS,
    refetchIntervalInBackground: false,
    retry: false,
  })

  const tvdbQuery = useQuery({
    queryKey: ["database-connection-check", "tvdb", reverseProxyUrl],
    enabled: isCheckEnabled,
    queryFn: async () => {
      try {
        const result = await getArtworkTypes()
        return result !== undefined
      } catch (err) {
        if (isInternalDatabaseCheckError(err)) {
          throw err
        }
        return false
      }
    },
    staleTime: DATABASE_CONNECTION_STALE_MS,
    refetchInterval: DATABASE_CONNECTION_CHECK_INTERVAL_MS,
    refetchIntervalInBackground: false,
    retry: false,
  })

  const tmdbStatus = mapQueryStatus(
    isCheckEnabled,
    tmdbQuery.isPending,
    tmdbQuery.isFetching,
    tmdbQuery.isError,
    tmdbQuery.data,
  )
  const tvdbStatus = mapQueryStatus(
    isCheckEnabled,
    tvdbQuery.isPending,
    tvdbQuery.isFetching,
    tvdbQuery.isError,
    tvdbQuery.data,
  )
  const hasWarning =
    tmdbStatus === "disconnected" ||
    tmdbStatus === "checkFailed" ||
    tvdbStatus === "disconnected" ||
    tvdbStatus === "checkFailed"

  return { tmdbStatus, tvdbStatus, hasWarning }
}
