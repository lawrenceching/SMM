import { useQuery } from "@tanstack/react-query"
import { useTmdbQueries } from "@/hooks/useTmdbQueries"
import { useTvdbQueries } from "@/hooks/useTvdbQueries"

const DATABASE_CONNECTION_CHECK_INTERVAL_MS = 60 * 1000
const DATABASE_CONNECTION_STALE_MS = 50 * 1000

export type DatabaseConnectionStatus = "connected" | "disconnected" | "checking"

export interface UseDatabaseConnectionStatusResult {
  tmdbStatus: DatabaseConnectionStatus
  tvdbStatus: DatabaseConnectionStatus
  hasWarning: boolean
}

export function useDatabaseConnectionStatus(): UseDatabaseConnectionStatusResult {
  const { getTvShowById } = useTmdbQueries()
  const { getArtworkTypes } = useTvdbQueries()

  const tmdbQuery = useQuery({
    queryKey: ["database-connection-check", "tmdb"],
    queryFn: async () => {
      try {
        await getTvShowById(1)
        return true
      } catch {
        return false
      }
    },
    staleTime: DATABASE_CONNECTION_STALE_MS,
    refetchInterval: DATABASE_CONNECTION_CHECK_INTERVAL_MS,
    refetchIntervalInBackground: false,
    retry: false,
  })

  const tvdbQuery = useQuery({
    queryKey: ["database-connection-check", "tvdb"],
    queryFn: async () => {
      try {
        const result = await getArtworkTypes()
        return result !== undefined
      } catch {
        return false
      }
    },
    staleTime: DATABASE_CONNECTION_STALE_MS,
    refetchInterval: DATABASE_CONNECTION_CHECK_INTERVAL_MS,
    refetchIntervalInBackground: false,
    retry: false,
  })

  const mapStatus = (
    isLoading: boolean,
    data: boolean | undefined
  ): DatabaseConnectionStatus => {
    if (isLoading) return "checking"
    if (data === true) return "connected"
    return "disconnected"
  }

  const tmdbStatus = mapStatus(tmdbQuery.isLoading, tmdbQuery.data)
  const tvdbStatus = mapStatus(tvdbQuery.isLoading, tvdbQuery.data)
  const hasWarning = tmdbStatus === "disconnected" || tvdbStatus === "disconnected"

  return { tmdbStatus, tvdbStatus, hasWarning }
}
