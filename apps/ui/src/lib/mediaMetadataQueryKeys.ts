import { Path } from "@core/path"
import { getMetadata } from "@/api/metadata"
import {
  hydrateMediaMetadataWithFolderFiles,
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
