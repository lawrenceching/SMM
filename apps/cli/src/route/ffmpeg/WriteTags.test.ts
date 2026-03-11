import { describe, it, expect, vi } from 'vitest'
import { processFfmpegWriteTags } from './WriteTags'

vi.mock('../../utils/Ffmpeg', () => ({
  writeMediaTags: async (filePath: string, tags: Record<string, string>) => {
    if (filePath.includes('not-found')) {
      return { error: 'File not found: /path/to/not-found.mp4' }
    }
    if (filePath.includes('no-permission')) {
      return { error: 'permission denied to write file' }
    }
    if (Object.keys(tags).length === 0) {
      return { error: 'tags are required' }
    }
    return { success: true }
  },
}))

vi.mock('../../../lib/logger', () => ({
  logger: { error: () => {} },
}))

vi.mock('@core/path', () => ({
  Path: class {
    constructor(private path: string) {}
    platformAbsPath() {
      return this.path
    }
  },
}))

describe('processFfmpegWriteTags', () => {
  it('should write tags successfully for valid file', async () => {
    const result = await processFfmpegWriteTags({
      path: '/path/to/video.mp4',
      tags: {
        title: 'New Title',
        artist: 'New Artist',
      }
    })
    expect(result.error).toBeUndefined()
    expect(result.success).toBe(true)
  })

  it('should return error for non-existent file', async () => {
    const result = await processFfmpegWriteTags({
      path: '/path/to/not-found.mp4',
      tags: { title: 'Test' }
    })
    expect(result.error).toBeDefined()
    expect(result.success).toBeUndefined()
    expect(result.error).toContain('File not found')
  })

  it('should return error for permission denied', async () => {
    const result = await processFfmpegWriteTags({
      path: '/path/to/no-permission.mp4',
      tags: { title: 'Test' }
    })
    expect(result.error).toBeDefined()
    expect(result.success).toBeUndefined()
    expect(result.error).toContain('permission denied')
  })

  it('should handle multiple tags', async () => {
    const result = await processFfmpegWriteTags({
      path: '/path/to/video.mp4',
      tags: {
        title: 'Test Title',
        artist: 'Test Artist',
        album: 'Test Album',
        date: '2024',
        genre: 'Test Genre'
      }
    })
    expect(result.error).toBeUndefined()
    expect(result.success).toBe(true)
  })

  it('should handle empty tags object', async () => {
    const result = await processFfmpegWriteTags({
      path: '/path/to/video.mp4',
      tags: {}
    })
    expect(result.error).toBeDefined()
    expect(result.success).toBeUndefined()
  })
})
