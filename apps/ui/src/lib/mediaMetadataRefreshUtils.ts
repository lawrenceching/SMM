import type { MediaMetadata } from '@smm/types'
import type { UIMediaFolderStatus } from '@/types/UIMediaFolder'

/**
 * Merges freshly fetched (backend) media metadata with the current UI-held
 * metadata: media content fields come from `response`, while UI-only props
 * (e.g. loading status) are preserved from `currentMediaMetadata`.
 */
export function mergeRefreshedMetadata(
  response: MediaMetadata,
  currentMediaMetadata: MediaMetadata | undefined,
): MediaMetadata & { status: UIMediaFolderStatus } {
  const currentStatus = (currentMediaMetadata as { status?: UIMediaFolderStatus } | undefined)
    ?.status
  const status: UIMediaFolderStatus = currentStatus ?? 'idle'
  return {
    ...currentMediaMetadata,
    ...response,
    status,
  }
}
