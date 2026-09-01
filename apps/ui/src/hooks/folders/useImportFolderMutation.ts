import { useMutation } from '@tanstack/react-query'
import { importFolderViaCore, type ImportFolderParams } from '@/api/importFolder'

export function useImportFolderMutation() {
  return useMutation({
    mutationFn: (params: ImportFolderParams) => importFolderViaCore(params),
  })
}
