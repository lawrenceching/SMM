import type { MediaMetadata } from '@smm/types'
import { Path } from '@smm/utils/path'

export function assertMediaFolderHasMetadata(
  exists: boolean,
  folderPath: string,
): string | undefined {
  if (!exists) {
    return `Error Reason: folderPath "${Path.posix(folderPath)}" is not opened in SMM`
  }
  return undefined
}

export function assertEpisodeVideoFile(
  metadata: MediaMetadata,
  fromPath: string,
): string | undefined {
  const fromPosix = Path.posix(fromPath)
  const mediaFile = (metadata.mediaFiles ?? []).find(
    (mf) => mf.absolutePath === fromPosix,
  )
  if (!mediaFile) {
    return 'Error Reason: Not Episode Video File'
  }
  return undefined
}
