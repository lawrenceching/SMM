import type { MediaMetadata } from "@core/types"
import { normalizeMediaFolderPathForQuery } from "@/hooks/mediaMetadata"

/** Match a tool input path (Windows or POSIX) to cached {@link MediaMetadata}. */
export function findMediaMetadataForPath(
  metadatas: MediaMetadata[],
  inputPath: string,
): MediaMetadata | undefined {
  const normalizedPath = normalizeMediaFolderPathForQuery(inputPath)
  return metadatas.find((metadata) => metadata.mediaFolderPath === normalizedPath)
}
