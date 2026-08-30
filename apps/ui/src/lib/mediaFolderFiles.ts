import type { MediaMetadata } from "@smm/types"
import { listFiles } from "@/api/listFiles"
import { Path } from "@smm/utils/path"

/** Live folder listing from `listFiles`; not persisted in metadata cache. */
export type MediaMetadataWithFolderFiles = MediaMetadata & {
  files?: string[]
}

export function getMediaFolderFiles(
  mm: MediaMetadataWithFolderFiles | null | undefined,
): string[] {
  return mm?.files ?? []
}

/** Keep the UI-only live listing when replacing cache with persisted metadata. */
export function withLiveFolderFiles(
  persisted: MediaMetadata,
  previous: MediaMetadataWithFolderFiles | null | undefined,
  incoming?: MediaMetadataWithFolderFiles,
): MediaMetadataWithFolderFiles {
  const files = previous?.files ?? incoming?.files
  if (files === undefined) {
    return persisted
  }
  return { ...persisted, files }
}

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

/** Attach live folder file paths to persisted metadata for UI consumers. */
export async function hydrateMediaMetadataWithFolderFiles(
  metadata: MediaMetadata,
  signal?: AbortSignal,
): Promise<MediaMetadataWithFolderFiles> {
  const folderPath = metadata.mediaFolderPath
  if (!folderPath) {
    return metadata
  }
  try {
    const files = await listMediaFolderFilePaths(folderPath, signal)
    return { ...metadata, files }
  } catch {
    return metadata
  }
}
