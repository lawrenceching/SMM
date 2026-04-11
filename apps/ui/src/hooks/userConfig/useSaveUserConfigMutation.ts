import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { HelloResponseBody, UserConfig } from "@core/types"
import { writeFile } from "@/api/writeFile"
import { defaultUserConfig } from "@/api/readUserConfig"
import { changeLanguage } from "@/lib/i18n"
import { join } from "@/lib/path"
import { helloQueryKey } from "@/lib/appQueryKeys"
import { userConfigQueryKey } from "@/lib/userConfigQueryKeys"

export function useSaveUserConfigMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ traceId, config }: { traceId: string; config: UserConfig }) => {
      const helloData = queryClient.getQueryData<HelloResponseBody>(helloQueryKey)
      const dir = helloData?.userDataDir
      if (!dir) {
        throw new Error("User data directory not found")
      }
      const prev =
        queryClient.getQueryData<UserConfig>(userConfigQueryKey(dir)) ?? defaultUserConfig
      if (config.applicationLanguage !== prev.applicationLanguage) {
        await changeLanguage(config.applicationLanguage)
      }
      const filePath = join(dir, "smm.json")
      await writeFile(filePath, JSON.stringify(config), traceId)
      return config
    },
    onSuccess: (config) => {
      const dir = queryClient.getQueryData<HelloResponseBody>(helloQueryKey)?.userDataDir
      if (dir) {
        queryClient.setQueryData(userConfigQueryKey(dir), config)
      }
    },
  })
}
