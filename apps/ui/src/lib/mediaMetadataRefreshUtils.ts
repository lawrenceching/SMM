import type { MediaMetadataWithFolderFiles } from '@/lib/mediaFolderFiles'
import type { MediaMetadata } from '@smm/types'

export function mergeRefreshedMetadata(
  response: MediaMetadata,
  currentMediaMetadata: MediaMetadataWithFolderFiles | undefined
): MediaMetadataWithFolderFiles {
  if (!currentMediaMetadata) {
    return response
  }

  const { files } = currentMediaMetadata
  return files !== undefined ? { ...response, files } : response
}
