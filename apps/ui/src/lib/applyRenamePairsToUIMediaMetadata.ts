import type { MediaFileMetadata } from "@core/types"
import { Path } from "@core/path"
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"

function pathKey(p: string): string {
  try {
    return Path.posix(p)
  } catch {
    return p
  }
}

/**
 * Apply completed on-disk renames to in-memory UIMediaMetadata (mediaFiles, files list).
 * Pairs must match what was passed to `/api/renameFiles` (POSIX paths as stored in metadata).
 */
export function applyRenamePairsToUIMediaMetadata(
  metadata: UIMediaMetadata,
  pairs: Array<{ from: string; to: string }>
): UIMediaMetadata {
  const map = new Map<string, string>()
  for (const { from, to } of pairs) {
    map.set(pathKey(from), to)
  }
  const remap = (p: string) => map.get(pathKey(p)) ?? p

  const next: UIMediaMetadata = { ...metadata }
  if (Array.isArray(next.files)) {
    next.files = next.files.map(remap)
  }
  if (next.mediaFiles?.length) {
    next.mediaFiles = next.mediaFiles.map(
      (mf): MediaFileMetadata => ({
        seasonNumber: mf.seasonNumber,
        episodeNumber: mf.episodeNumber,
        absolutePath: remap(mf.absolutePath),
        subtitleFilePaths: mf.subtitleFilePaths?.map(remap),
        audioFilePaths: mf.audioFilePaths?.map(remap),
      })
    )
  }
  return next
}
