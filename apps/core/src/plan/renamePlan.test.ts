import { describe, it, expect } from 'vitest'
import { assertEpisodeVideoFile } from './renamePlan'
import type { MediaMetadata } from '@smm/types'

describe('renamePlan', () => {
  it('assertEpisodeVideoFile fails when file is not in metadata', () => {
    const metadata = {
      mediaFiles: [{ absolutePath: '/media/show/S01E01.mp4' }],
    } as MediaMetadata
    expect(assertEpisodeVideoFile(metadata, '/media/show/other.mp4')).toBeDefined()
  })
})
