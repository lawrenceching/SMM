import { useQuery } from "@tanstack/react-query"
import {
  fetchDiscoveredMediaDatabases,
  type MediaDatabaseEndpoint,
} from "@/api/discover"

export const discoveredMediaDatabasesQueryKey = ["discoveredMediaDatabases"] as const

/**
 * Hook that returns the list of media database endpoints discovered via
 * the CLI's `/api/discover` endpoint. The result is cached for the entire
 * lifetime of the application (staleTime: Infinity, gcTime: Infinity)
 * because the remote config rarely changes during a session.
 */
export function useDiscoveredMediaDatabaseBaseUrls() {
  return useQuery<MediaDatabaseEndpoint[]>({
    queryKey: discoveredMediaDatabasesQueryKey,
    queryFn: fetchDiscoveredMediaDatabases,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  })
}
