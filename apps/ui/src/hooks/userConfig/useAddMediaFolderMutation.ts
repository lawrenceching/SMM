import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { HelloResponseBody, UserConfig } from "@smm/types"
import { hello } from "@/api/hello"
import { patchUserConfigRequest } from "@/api/userConfigHttp"
import { defaultUserConfig, normalizeUserConfig } from "@/api/readUserConfig"
import { helloQueryKey } from "@/lib/appQueryKeys"
import { userConfigQueryKey } from "@/lib/userConfigQueryKeys"
import { invalidateFoldersQuery } from "@/hooks/folders"

export function useAddMediaFolderMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ traceId, folder }: { traceId: string; folder: string }) => {
      let helloData = queryClient.getQueryData<HelloResponseBody>(helloQueryKey)
      if (!helloData?.userDataDir) {
        helloData = await queryClient.fetchQuery({
          queryKey: helloQueryKey,
          queryFn: () => hello(),
        })
      }
      const dir = helloData?.userDataDir
      if (!dir) {
        throw new Error("User data directory not found")
      }
      const prev =
        queryClient.getQueryData<UserConfig>(userConfigQueryKey(dir)) ?? defaultUserConfig
      if (prev.folders.includes(folder)) {
        return { config: prev, foldersChanged: false }
      }
      const saved = normalizeUserConfig(
        await patchUserConfigRequest(
          [{ op: "add", path: "/folders/-", value: folder }],
          traceId,
        ),
      )
      return { config: saved, foldersChanged: true }
    },
    onSuccess: ({ config, foldersChanged }) => {
      const dir = queryClient.getQueryData<HelloResponseBody>(helloQueryKey)?.userDataDir
      if (dir) {
        queryClient.setQueryData(userConfigQueryKey(dir), config)
      }
      if (foldersChanged) {
        invalidateFoldersQuery(queryClient)
      }
    },
  })
}
