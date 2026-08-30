import { Path } from "@core/path"
import type { MediaMetadata } from "@core/types"
import type { QueryClient } from "@tanstack/react-query"
import { getMetadata } from "@/api/metadata"
import {
  hydrateMediaMetadataWithFolderFiles,
  withLiveFolderFiles,
  type MediaMetadataWithFolderFiles,
} from "@/lib/mediaFolderFiles"

/** TanStack Query keys for per-folder persisted metadata. */
export function mediaMetadataQueryKey(folderPathPosix: string) {
  return ["mediaMetadata", folderPathPosix] as const
}

/** Normalize folder paths so the same folder does not get duplicate cache entries on Windows vs POSIX. */
export function normalizeMediaFolderPathForQuery(path: string): string {
  return Path.posix(path)
}

/**
 * Write persisted metadata into the query cache without dropping the
 * UI-only live folder listing (`files`).
 */
export function setPersistedMetadataQueryData(
  queryClient: QueryClient,
  folderPathPosix: string,
  persisted: MediaMetadata,
  incoming?: MediaMetadata,
): void {
  const key = mediaMetadataQueryKey(folderPathPosix)
  queryClient.setQueryData<MediaMetadataWithFolderFiles>(key, (prev) =>
    withLiveFolderFiles(persisted, prev, incoming),
  )
}

/** Shared options for `useQuery` / `queryClient.fetchQuery` so cache identity matches. */
export function mediaMetadataReadQueryOptions(path: string) {
  const folderPathPosix = normalizeMediaFolderPathForQuery(path)
  return {
    queryKey: mediaMetadataQueryKey(folderPathPosix),
    queryFn: async ({ signal }: { signal?: AbortSignal } = {}): Promise<MediaMetadataWithFolderFiles> => {
      const metadata = await getMetadata(folderPathPosix, signal)
      return hydrateMediaMetadataWithFolderFiles(metadata, signal)
    },
  }
}
