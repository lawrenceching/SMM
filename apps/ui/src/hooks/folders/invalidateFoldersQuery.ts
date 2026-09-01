import type { QueryClient } from '@tanstack/react-query'
import { foldersQueryKey } from './foldersQueryKeys'

/** Invalidate the folders list query (v3 is always on). */
export function invalidateFoldersQueryIfV3(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: foldersQueryKey })
}
