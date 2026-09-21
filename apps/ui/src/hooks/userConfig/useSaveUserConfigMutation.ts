import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { HelloResponseBody, UserConfig, UserConfigPatchOperation } from "@smm/types"
import { resolveAppLanguage } from "@smm/utils/locale"
import { patchUserConfigRequest } from "@/api/userConfigHttp"
import { defaultUserConfig, normalizeUserConfig } from "@/api/readUserConfig"
import { changeLanguage } from "@/lib/i18n"
import { helloQueryKey } from "@/lib/appQueryKeys"
import { userConfigQueryKey } from "@/lib/userConfigQueryKeys"
import { invalidateFoldersQuery } from "@/hooks/folders"

export function useSaveUserConfigMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      traceId,
      patch,
    }: {
      traceId: string
      patch: UserConfigPatchOperation[]
    }) => {
      const helloData = queryClient.getQueryData<HelloResponseBody>(helloQueryKey)
      const dir = helloData?.userDataDir
      if (!dir) {
        throw new Error("User data directory not found")
      }
      const prev =
        queryClient.getQueryData<UserConfig>(userConfigQueryKey(dir)) ?? defaultUserConfig
      const languageOp = patch.find((operation) => operation.path === "/applicationLanguage")
      if (languageOp) {
        const configured =
          languageOp.op === "remove" ? undefined : (languageOp.value as UserConfig["applicationLanguage"])
        if (configured !== prev.applicationLanguage) {
          const resolved = resolveAppLanguage({
            configured,
            browserLocale: typeof navigator !== "undefined" ? navigator.language : undefined,
            osLocale: helloData?.osLocale,
          })
          await changeLanguage(resolved)
        }
      }
      const saved =
        patch.length === 0 ? prev : normalizeUserConfig(await patchUserConfigRequest(patch, traceId))
      return { config: saved, prevFolders: prev.folders }
    },
    onSuccess: ({ config, prevFolders }) => {
      const dir = queryClient.getQueryData<HelloResponseBody>(helloQueryKey)?.userDataDir
      if (dir) {
        queryClient.setQueryData(userConfigQueryKey(dir), config)
      }
      const foldersChanged =
        prevFolders.length !== config.folders.length ||
        prevFolders.some((p, i) => p !== config.folders[i])
      if (foldersChanged) {
        invalidateFoldersQuery(queryClient)
      }
    },
  })
}
