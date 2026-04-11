import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { HelloResponseBody } from "@core/types"
import { helloQueryKey } from "@/lib/appQueryKeys"
import { userConfigQueryKey } from "@/lib/userConfigQueryKeys"

/** Re-fetch `smm.json` into the TanStack Query cache (e.g. after external updates). */
export function useRefreshUserConfig() {
  const queryClient = useQueryClient()
  return useCallback(async () => {
    const hello = queryClient.getQueryData<HelloResponseBody>(helloQueryKey)
    const dir = hello?.userDataDir
    if (!dir) return
    await queryClient.invalidateQueries({ queryKey: userConfigQueryKey(dir) })
  }, [queryClient])
}
