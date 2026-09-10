import type { QueryClient } from '@tanstack/react-query'
import { foldersQueryKey } from './foldersQueryKeys'

/** Invalidate the folders list query (`useFoldersQuery`). */
export function invalidateFoldersQuery(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: foldersQueryKey })
}
