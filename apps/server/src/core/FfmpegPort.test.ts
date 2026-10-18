import { describe, expect, it } from 'vitest'
import { FFMPEG_TIMEOUT_MS } from './FfmpegPort'

describe('FFMPEG_TIMEOUT_MS', () => {
  it('is at least 2 hours', () => {
    expect(FFMPEG_TIMEOUT_MS).toBeGreaterThanOrEqual(2 * 60 * 60 * 1000)
  })
})
