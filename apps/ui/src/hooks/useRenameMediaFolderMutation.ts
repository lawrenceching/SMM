import { useMutation, useQueryClient, type UseMutationOptions } from "@tanstack/react-query"
import type { HelloResponseBody } from "@core/types"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"
import { renameFolder } from "@/api/renameFolder"
import { mediaMetadataQueryKey, normalizeMediaFolderPathForQuery } from "@/lib/mediaMetadataQueryKeys"
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore"
import { dirname, join } from "@/lib/path"
import { helloQueryKey } from "@/lib/appQueryKeys"
import { userConfigQueryKey } from "@/lib/userConfigQueryKeys"

export interface RenameMediaFolderVariables {
  mediaFolderPath: string
  newName: string
}

/**
 * Runs {@link doRenameFolder} with API + store actions. Default `onError` shows
 * `mediaFolder.renameError` toast; pass `onError` in options to run additional logic (toast still runs after).
 */
export function useRenameMediaFolderMutation(
  options?: Omit<
    UseMutationOptions<void, Error, RenameMediaFolderVariables, unknown>,
    "mutationFn"
  >
) {
  const { t } = useTranslation(["components"])
  const queryClient = useQueryClient()
  const { onError: userOnError, ...restOptions } = options ?? {}
  const { folders, setFolders, setSelectedFolder } = useUIMediaFolderStore()

  return useMutation({
    ...restOptions,
    mutationFn: async ({ mediaFolderPath, newName }: RenameMediaFolderVariables) => {
      const folder = folders.find(
        (item) => item.path === mediaFolderPath,
      )
      if (!folder) {
        throw new Error(`Media folder not found: ${mediaFolderPath}`)
      }
      const newFolderPath = join(dirname(mediaFolderPath), newName)

      // 1) call RenameFolder API
      await renameFolder({ from: mediaFolderPath, to: newFolderPath })
      setFolders(folders.map(folder => folder.path === mediaFolderPath ? { ...folder, path: newFolderPath } : folder))
      setSelectedFolder(newFolderPath)

      const hello = queryClient.getQueryData<HelloResponseBody>(helloQueryKey)
      // 2) refresh UIMediaFolderStore via userConfig query -> initializer syncs store from query result
      if (hello?.userDataDir) {
        await queryClient.invalidateQueries({
          queryKey: userConfigQueryKey(hello.userDataDir),
        })
      }

      // 3) refresh media metadata queries
      queryClient.removeQueries({
        queryKey: mediaMetadataQueryKey(normalizeMediaFolderPathForQuery(mediaFolderPath)),
      })
      await queryClient.invalidateQueries({
        queryKey: mediaMetadataQueryKey(normalizeMediaFolderPathForQuery(newFolderPath)),
      })
    },
    onError: (error, variables, context, mutation) => {
      userOnError?.(error, variables, context, mutation)
      const message = error instanceof Error ? error.message : "Unknown error"
      toast.error(t("mediaFolder.renameError", { ns: "components", error: message }))
    },
  })
}
