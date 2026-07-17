import { useQuery } from "@tanstack/react-query";
import { fetchDiscoverConfig } from "@/api/discover";
import { discoverConfigQueryKey } from "@/lib/appQueryKeys";

const STALE_TIME_MS = 60 * 60 * 1000;

export function useDiscoverConfig() {
  return useQuery({
    queryKey: discoverConfigQueryKey,
    queryFn: fetchDiscoverConfig,
    staleTime: STALE_TIME_MS,
    retry: 1,
  });
}
