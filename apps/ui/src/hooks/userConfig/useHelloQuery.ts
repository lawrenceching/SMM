import { useQuery } from "@tanstack/react-query"
import type { HelloResponseBody } from "@core/types"
import { hello } from "@/api/hello"
import { helloQueryKey } from "@/lib/appQueryKeys"

/**
 * Reads cached `hello()` data. Does not auto-fetch on mount — populate via
 * `reload` / `queryClient.fetchQuery(helloQueryKey)` so bootstrap matches the prior ConfigProvider flow.
 */
export function useHelloQuery() {
  return useQuery<HelloResponseBody>({
    queryKey: helloQueryKey,
    queryFn: () => hello(),
    enabled: false,
  })
}
