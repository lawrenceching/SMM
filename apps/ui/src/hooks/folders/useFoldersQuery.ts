import { useQuery } from '@tanstack/react-query'
import { getFolders } from '@/api/getFolders'
import { isSmmV3Enabled } from '@/lib/localStorages'
import { foldersQueryKey } from './foldersQueryKeys'

export function useFoldersQuery() {
  const enabled = isSmmV3Enabled()
  return useQuery({
    queryKey: foldersQueryKey,
    enabled,
    queryFn: async (): Promise<string[]> => {
      const resp = await getFolders()
      if (resp.error) throw new Error(resp.error)
      return resp.data?.folders ?? []
    },
  })
}
