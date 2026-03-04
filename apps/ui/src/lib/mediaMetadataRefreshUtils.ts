import { extractUIMediaMetadataProps, type UIMediaMetadata } from '@/types/UIMediaMetadata'
import type { MediaMetadata } from '@core/types'

export function mergeRefreshedMetadata(
  response: MediaMetadata,
  currentMediaMetadata: UIMediaMetadata | undefined
): UIMediaMetadata {
  return currentMediaMetadata
    ? { ...response, ...extractUIMediaMetadataProps(currentMediaMetadata) }
    : { ...response, status: 'idle' }
}
