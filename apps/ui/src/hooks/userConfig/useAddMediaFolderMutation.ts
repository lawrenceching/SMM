import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { HelloResponseBody, UserConfig } from "@core/types"
import { writeFile } from "@/api/writeFile"
import { defaultUserConfig } from "@/api/readUserConfig"
import { join } from "@/lib/path"
import { helloQueryKey } from "@/lib/appQueryKeys"
import { userConfigQueryKey } from "@/lib/userConfigQueryKeys"

export function useAddMediaFolderMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ traceId, folder }: { traceId: string; folder: string }) => {
      const helloData = queryClient.getQueryData<HelloResponseBody>(helloQueryKey)
      const dir = helloData?.userDataDir
      if (!dir) {
        throw new Error("User data directory not found")
      }
      const prev =
        queryClient.getQueryData<UserConfig>(userConfigQueryKey(dir)) ?? defaultUserConfig
      if (prev.folders.includes(folder)) {
        return prev
      }
      const updatedConfig: UserConfig = {
        ...prev,
        folders: [...new Set([...prev.folders, folder])],
      }
      const filePath = join(dir, "smm.json")
      await writeFile(filePath, JSON.stringify(updatedConfig), traceId)
      return updatedConfig
    },
    onSuccess: (config) => {
      const dir = queryClient.getQueryData<HelloResponseBody>(helloQueryKey)?.userDataDir
      if (dir) {
        queryClient.setQueryData(userConfigQueryKey(dir), config)
      }
    },
  })
}
