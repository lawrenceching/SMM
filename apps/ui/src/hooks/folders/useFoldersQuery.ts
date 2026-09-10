import { useQuery } from '@tanstack/react-query'
import { getFolders } from '@/api/getFolders'
import { foldersQueryKey } from './foldersQueryKeys'

export function useFoldersQuery() {
  return useQuery({
    queryKey: foldersQueryKey,
    queryFn: async (): Promise<string[]> => {
      const resp = await getFolders()
      if (resp.error) throw new Error(resp.error)
      return resp.data?.folders ?? []
    },
  })
}
