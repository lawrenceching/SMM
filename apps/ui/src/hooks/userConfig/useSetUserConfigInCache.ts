import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { HelloResponseBody, UserConfig } from "@core/types"
import { defaultUserConfig } from "@/api/readUserConfig"
import { helloQueryKey } from "@/lib/appQueryKeys"
import { userConfigQueryKey } from "@/lib/userConfigQueryKeys"

export function useSetUserConfigInCache() {
  const queryClient = useQueryClient()
  return useCallback(
    (config: UserConfig | ((prevConfig: UserConfig) => UserConfig)) => {
      const hello = queryClient.getQueryData<HelloResponseBody>(helloQueryKey)
      const dir = hello?.userDataDir
      if (!dir) {
        console.error("[useSetUserConfigInCache] User data directory not found")
        return
      }
      queryClient.setQueryData<UserConfig>(userConfigQueryKey(dir), (prev) => {
        const base = prev ?? defaultUserConfig
        return typeof config === "function" ? config(base) : config
      })
    },
    [queryClient],
  )
}
