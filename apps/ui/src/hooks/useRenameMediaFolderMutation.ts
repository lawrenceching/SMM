import { useMutation, useQueryClient, type UseMutationOptions } from "@tanstack/react-query"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"
import { renameFolder } from "@/api/renameFolder"
import { useMediaMetadataActions } from "@/actions/mediaMetadataActions"
import { useMediaMetadataStoreActions } from "@/stores/mediaMetadataStore"
import { doRenameFolder } from "@/lib/doRenameFolder"
import { nextTraceId } from "@/lib/utils"
import { useUpdateMediaMetadataMutation } from "@/hooks/mediaMetadata/useUpdateMediaMetadataMutation"
import { mediaMetadataQueryKey, normalizeMediaFolderPathForQuery } from "@/lib/mediaMetadataQueryKeys"

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
  const updatePersistedMutation = useUpdateMediaMetadataMutation()
  const { getMediaMetadata, addMediaMetadata } = useMediaMetadataStoreActions()
  const { deleteMediaMetadata } = useMediaMetadataActions()
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
          writePersistedMetadata: async (pathPosix, metadata, tid) => {
            await updatePersistedMutation.mutateAsync({
              pathPosix,
              metadata,
              traceId: tid,
            })
          },
          removeQueryDataForPath: (folderPath) => {
            const k = normalizeMediaFolderPathForQuery(folderPath)
            queryClient.removeQueries({ queryKey: mediaMetadataQueryKey(k) })
          },
          addMediaMetadataToStore: (metadata) => {
            addMediaMetadata(metadata)
          },
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
