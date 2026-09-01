import type { MediaFileMetadata, MediaMetadata } from "@smm/types"
import { Path } from "@smm/utils/path"

function pathKey(p: string): string {
  try {
    return Path.posix(p)
  } catch {
    return p
  }
}

/**
 * Apply completed on-disk renames to in-memory metadata (mediaFiles).
 * Pairs must match what was passed to `/api/renameFiles` (POSIX paths as stored in metadata).
 */
export function applyRenamePairsToUIMediaMetadata(
  metadata: MediaMetadata,
  pairs: Array<{ from: string; to: string }>,
): MediaMetadata {
  const map = new Map<string, string>()
  for (const { from, to } of pairs) {
    map.set(pathKey(from), to)
  }
  const remap = (p: string) => map.get(pathKey(p)) ?? p

  const next: MediaMetadata = { ...metadata }
  if (next.mediaFiles?.length) {
    next.mediaFiles = next.mediaFiles.map(
      (mf): MediaFileMetadata => ({
        seasonNumber: mf.seasonNumber,
        episodeNumber: mf.episodeNumber,
        absolutePath: remap(mf.absolutePath),
        subtitleFilePaths: mf.subtitleFilePaths?.map(remap),
        audioFilePaths: mf.audioFilePaths?.map(remap),
      }),
    )
  }
  return next
}
