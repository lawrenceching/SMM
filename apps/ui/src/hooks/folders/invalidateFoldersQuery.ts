import type { QueryClient } from '@tanstack/react-query'
import { isSmmV3Enabled } from '@/lib/localStorages'
import { foldersQueryKey } from './foldersQueryKeys'

export function invalidateFoldersQueryIfV3(queryClient: QueryClient): void {
  if (!isSmmV3Enabled()) return
  void queryClient.invalidateQueries({ queryKey: foldersQueryKey })
}
