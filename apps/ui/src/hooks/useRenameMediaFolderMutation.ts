import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n'
import { renameFolder } from '@/api/renameFolder'
import { refreshUiAfterFolderRename } from '@/lib/refreshUiAfterFolderRename'
import { useUIMediaFolderStore } from '@/stores/uiMediaFolderStore'
import { dirname, join } from '@/lib/path'

export interface RenameMediaFolderVariables {
  mediaFolderPath: string
  newName: string
}

/**
 * Renames a media folder via API and refreshes client state.
 */
export function useRenameMediaFolderMutation(
  options?: Omit<
    UseMutationOptions<void, Error, RenameMediaFolderVariables, unknown>,
    'mutationFn'
  >,
) {
  const { t } = useTranslation(['components'])
  const queryClient = useQueryClient()
  const { onError: userOnError, ...restOptions } = options ?? {}
  const { folders, setFolders, setSelectedFolder } = useUIMediaFolderStore()

  return useMutation({
    ...restOptions,
    mutationFn: async ({ mediaFolderPath, newName }: RenameMediaFolderVariables) => {
      const folder = folders.find((item) => item.path === mediaFolderPath)
      if (!folder) {
        throw new Error(`Media folder not found: ${mediaFolderPath}`)
      }
      const newFolderPath = join(dirname(mediaFolderPath), newName)

      await renameFolder({ from: mediaFolderPath, to: newFolderPath })

      await refreshUiAfterFolderRename({
        queryClient,
        folders,
        setFolders,
        setSelectedFolder,
        from: mediaFolderPath,
        to: newFolderPath,
      })
    },
    onError: (error, variables, context, mutation) => {
      userOnError?.(error, variables, context, mutation)
      const message = error instanceof Error ? error.message : 'Unknown error'
      toast.error(t('mediaFolder.renameError', { ns: 'components', error: message }))
    },
  })
}
