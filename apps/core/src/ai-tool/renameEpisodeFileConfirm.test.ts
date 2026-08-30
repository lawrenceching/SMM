import { describe, expect, it } from 'vitest'
import {
  buildRenameEpisodeFileConfirmationMessage,
  getEpisodeBasename,
} from './renameEpisodeFileConfirm'

describe('renameEpisodeFileConfirm', () => {
  it('getEpisodeBasename returns last path segment', () => {
    expect(getEpisodeBasename('/m/Show/S01E01.mp4')).toBe('S01E01.mp4')
  })

  it('buildRenameEpisodeFileConfirmationMessage mentions associates', () => {
    const msg = buildRenameEpisodeFileConfirmationMessage(
      '/m/Show/S01E01.mp4',
      '/m/Show/S01E01_renamed.mp4',
    )
    expect(msg).toContain('"S01E01.mp4"')
    expect(msg).toContain('"S01E01_renamed.mp4"')
    expect(msg).toContain('same-stem associated files')
  })
})
