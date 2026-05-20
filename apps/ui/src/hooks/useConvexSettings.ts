import { useQuery } from "@tanstack/react-query";
import { fetchConvexSettings, getConvexSiteUrl } from "@/api/convexSettings";
import { convexSettingsQueryKey } from "@/lib/appQueryKeys";

const STALE_TIME_MS = 60 * 60 * 1000;

export function useConvexSettings() {
  const siteUrl = getConvexSiteUrl();
  return useQuery({
    queryKey: convexSettingsQueryKey,
    queryFn: fetchConvexSettings,
    enabled: Boolean(siteUrl),
    staleTime: STALE_TIME_MS,
    retry: 1,
  });
}
