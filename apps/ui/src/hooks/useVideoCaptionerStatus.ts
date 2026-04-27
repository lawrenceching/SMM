import { useQuery } from "@tanstack/react-query"
import { discoverVideoCaptioner } from "@/api/videocaptioner"

const VIDEOCAPTIONER_DISCOVERY_CHECK_INTERVAL_MS = 60 * 1000
const VIDEOCAPTIONER_DISCOVERY_STALE_MS = 50 * 1000

export interface UseVideoCaptionerStatusResult {
  isAvailable: boolean
  isChecking: boolean
}

export function useVideoCaptionerStatus(): UseVideoCaptionerStatusResult {
  const query = useQuery({
    queryKey: ["videocaptioner-discovery-status"],
    queryFn: async () => {
      try {
        const result = await discoverVideoCaptioner()
        return Boolean(result.path) && !result.error
      } catch {
        return false
      }
    },
    staleTime: VIDEOCAPTIONER_DISCOVERY_STALE_MS,
    refetchInterval: VIDEOCAPTIONER_DISCOVERY_CHECK_INTERVAL_MS,
    refetchIntervalInBackground: false,
    retry: false,
  })

  return {
    isAvailable: query.data === true,
    isChecking: query.isLoading,
  }
}
