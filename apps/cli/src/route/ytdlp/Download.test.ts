import { describe, it, expect, vi } from 'vitest'
import { processYtdlpDownload } from './Download'

vi.mock('../../utils/Ytdlp', () => ({
  downloadYtdlpVideo: async () => ({ success: true, path: '/tmp/video.mp4' }),
}))

vi.mock('../../../lib/logger', () => ({
  logger: { error: () => {} },
}))

describe('processYtdlpDownload', () => {
  it('should reject empty URL', async () => {
    const result = await processYtdlpDownload({ url: '' })
    expect(result.error).toBe('URL_EMPTY')
  })

  it('should reject invalid URL format', async () => {
    const result = await processYtdlpDownload({ url: 'not-a-url' })
    expect(result.error).toBe('URL_INVALID')
  })

  it('should reject unsupported platform', async () => {
    const result = await processYtdlpDownload({ url: 'https://vimeo.com/123456' })
    expect(result.error).toBe('URL_PLATFORM_NOT_ALLOWED')
  })

  it('should proceed with valid YouTube URL', async () => {
    const result = await processYtdlpDownload({ url: 'https://www.youtube.com/watch?v=abc123' })
    expect(result.error).toBeUndefined()
    expect(result.success).toBe(true)
  })

  it('should proceed with valid Bilibili URL', async () => {
    const result = await processYtdlpDownload({ url: 'https://www.bilibili.com/video/BV1xx411c7mD' })
    expect(result.error).toBeUndefined()
    expect(result.success).toBe(true)
  })
})
