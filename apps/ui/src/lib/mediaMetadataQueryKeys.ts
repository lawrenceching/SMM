import { Path } from "@smm/utils/path"
import type { MediaMetadata } from "@smm/types"
import type { QueryClient } from "@tanstack/react-query"
import { getMetadata } from "@/api/metadata"

/** TanStack Query keys for per-folder persisted metadata. */
export function mediaMetadataQueryKey(folderPathPosix: string) {
  return ["mediaMetadata", folderPathPosix] as const
}

/** Normalize folder paths so the same folder does not get duplicate cache entries on Windows vs POSIX. */
export function normalizeMediaFolderPathForQuery(path: string): string {
  return Path.posix(path)
}

/** Write persisted metadata into the query cache. */
export function setPersistedMetadataQueryData(
  queryClient: QueryClient,
  folderPathPosix: string,
  persisted: MediaMetadata,
): void {
  queryClient.setQueryData(mediaMetadataQueryKey(folderPathPosix), persisted)
}

/** Shared options for `useQuery` / `queryClient.fetchQuery` so cache identity matches. */
export function mediaMetadataReadQueryOptions(path: string) {
  const folderPathPosix = normalizeMediaFolderPathForQuery(path)
  return {
    queryKey: mediaMetadataQueryKey(folderPathPosix),
    queryFn: async ({ signal }: { signal?: AbortSignal } = {}): Promise<MediaMetadata> => {
      return getMetadata(folderPathPosix, signal)
    },
  }
}
