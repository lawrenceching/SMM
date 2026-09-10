import type { MediaMetadata } from "@smm/types"
import { listFiles } from "@/api/listFiles"
import { Path } from "@smm/utils/path"
import { associatedFilesQueryKey } from "@/lib/associatedFilesQueryKeys"

export type { MediaMetadata }

/** @deprecated Use `MediaMetadata` directly. */
export type MediaMetadataWithFolderFiles = MediaMetadata

export async function listMediaFolderFilePaths(
  folderPath: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const result = await listFiles(
    { path: folderPath, recursively: true, onlyFiles: true },
    signal,
  )
  if (result.error) {
    throw new Error(`Failed to list files: ${result.error}`)
  }
  if (result.data === undefined) {
    throw new Error("Failed to list files: response.data is undefined")
  }
  return result.data.items.map((item) => Path.posix(item.path))
}

/** Shared TanStack Query options for live folder file listings (`associatedFiles` cache). */
export function mediaFolderFilesReadQueryOptions(folderPath: string) {
  const folderPathPosix = Path.posix(folderPath)
  return {
    queryKey: associatedFilesQueryKey(folderPathPosix),
    queryFn: async ({ signal }: { signal?: AbortSignal } = {}) =>
      listMediaFolderFilePaths(folderPathPosix, signal),
  }
}
