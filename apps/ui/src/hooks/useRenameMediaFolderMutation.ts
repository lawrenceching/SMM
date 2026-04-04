import { useMutation, type UseMutationOptions } from "@tanstack/react-query"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"
import { renameFolder } from "@/api/renameFolder"
import { useMediaMetadataActions } from "@/actions/mediaMetadataActions"
import { useMediaMetadataStoreActions } from "@/stores/mediaMetadataStore"
import { doRenameFolder } from "@/lib/doRenameFolder"
import { nextTraceId } from "@/lib/utils"

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
  const { getMediaMetadata } = useMediaMetadataStoreActions()
  const { deleteMediaMetadata, updateMediaMetadata, refreshMediaMetadata } = useMediaMetadataActions()
  const { onError: userOnError, ...restOptions } = options ?? {}

  return useMutation({
    ...restOptions,
    mutationFn: async ({ mediaFolderPath, newName }: RenameMediaFolderVariables) => {
      const currentMetadata = getMediaMetadata(mediaFolderPath)
      if (!currentMetadata) {
        throw new Error(`Media metadata not found for path: ${mediaFolderPath}`)
      }
      const traceId = `RenameMediaFolder-${nextTraceId()}`
      await doRenameFolder(
        mediaFolderPath,
        newName,
        currentMetadata,
        {
          renameFolderApi: renameFolder,
          deleteMediaMetadata,
          updateMediaMetadata,
          refreshMediaMetadata,
        },
        traceId
      )
    },
    onError: (error, variables, context) => {
      userOnError?.(error, variables, context)
      const message = error instanceof Error ? error.message : "Unknown error"
      toast.error(t("mediaFolder.renameError", { ns: "components", error: message }))
    },
  })
}
