import type { MediaMetadata } from '@smm/types'

export function mergeRefreshedMetadata(
  response: MediaMetadata,
  _currentMediaMetadata: MediaMetadata | undefined,
): MediaMetadata {
  return response
}
