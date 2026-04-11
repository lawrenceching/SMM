import { useCallback, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { UserConfig } from "@core/types"
import { hello } from "@/api/hello"
import { readUserConfigFromUserDataDir } from "@/api/readUserConfig"
import { helloQueryKey } from "@/lib/appQueryKeys"
import { userConfigQueryKey } from "@/lib/userConfigQueryKeys"

export interface ReloadCallback {
  onSuccess?: (config: UserConfig) => void | Promise<void>
  onError?: (error: Error) => void | Promise<void>
}

export function useReloadAppConfig() {
  const queryClient = useQueryClient()
  const [reloadLoading, setReloadLoading] = useState(false)
  const [reloadError, setReloadError] = useState<Error | null>(null)

  const reload = useCallback(
    async (callback?: ReloadCallback) => {
      try {
        setReloadLoading(true)
        setReloadError(null)

        const data = await queryClient.fetchQuery({
          queryKey: helloQueryKey,
          queryFn: () => hello(),
        })
        console.log(`[useReloadAppConfig] Reloaded user data directory: ${data.userDataDir}`)

        const config = await queryClient.fetchQuery({
          queryKey: userConfigQueryKey(data.userDataDir),
          queryFn: () => readUserConfigFromUserDataDir(data.userDataDir),
        })
        console.log("[useReloadAppConfig] Reloaded user config", config)

        if (callback?.onSuccess) {
          await callback.onSuccess(config)
        }
      } catch (err) {
        const errObj = err instanceof Error ? err : new Error("Unknown error")
        console.error("Failed to fetch app config:", err)
        setReloadError(errObj)
        if (callback?.onError) {
          await callback.onError(errObj)
        }
      } finally {
        setReloadLoading(false)
      }
    },
    [queryClient],
  )

  return { reload, reloadLoading, reloadError }
}
