import { Path } from "@core/path"
import type { MediaMetadata } from "@core/types"
import { mediaMetadataRepository } from "@/api/mediaMetadataRepository"

/** TanStack Query keys for per-folder persisted metadata (cache / disk via repository). */
export function mediaMetadataQueryKey(folderPathPosix: string) {
  return ["mediaMetadata", folderPathPosix] as const
}

/** Normalize folder paths so the same folder does not get duplicate cache entries on Windows vs POSIX. */
export function normalizeMediaFolderPathForQuery(path: string): string {
  return Path.posix(path)
}

/** Shared options for `useQuery` / `queryClient.fetchQuery` so cache identity matches. */
export function mediaMetadataReadQueryOptions(path: string, opts?: { traceId?: string; defaultType?: import("@core/types").MediaMetadata["type"] }) {
  const folderPathPosix = normalizeMediaFolderPathForQuery(path)
  return {
    queryKey: mediaMetadataQueryKey(folderPathPosix),
    queryFn: (): Promise<MediaMetadata> =>
      mediaMetadataRepository.read(folderPathPosix, opts ?? {}),
  }
}
