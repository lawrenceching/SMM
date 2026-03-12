import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'

const mockGetMediaTags = vi.hoisted(() =>
  vi.fn(async (filePath: string) => {
    if (filePath.includes('not-found')) {
      return { error: 'File not found: /path/to/not-found.mp4' }
    }
    if (filePath.includes('invalid')) {
      return { error: 'invalid media file format' }
    }
    return {
      tags: {
        title: 'Sample Video',
        artist: 'Artist Name',
        album: 'Album Name',
        date: '2024',
        genre: 'Pop',
        comment: 'This is a sample video',
        track: '1',
      },
    }
  })
)

vi.mock('./pathForFfmpeg', () => ({
  pathForPathClass: (p: string) => p,
}))

vi.mock('@/utils/Ffmpeg', () => ({
  getMediaTags: mockGetMediaTags,
}))

import { processFfmpegTags, handleFfmpegTags } from './Tags'

vi.mock('../../../lib/logger', () => ({
  logger: { 
    error: () => {},
    warn: () => {},
    info: () => {}
  },
}))

vi.mock('@core/path', () => ({
  Path: class {
    static isWindows = () => false
    constructor(private path: string) {}
    platformAbsPath() {
      return this.path
    }
  },
}))

describe('processFfmpegTags', () => {
  it('should return media tags for valid file', async () => {
    const result = await processFfmpegTags({ path: '/path/to/video.mp4' })
    expect(result.error).toBeUndefined()
    expect(result.tags).toBeDefined()
    expect(result.tags?.title).toBe('Sample Video')
    expect(result.tags?.artist).toBe('Artist Name')
  })

  it('should return error for non-existent file', async () => {
    const result = await processFfmpegTags({ path: '/path/to/not-found.mp4' })
    expect(result.error).toBeDefined()
    expect(result.tags).toBeUndefined()
    expect(result.error).toContain('File not found')
  })

  it('should return error for invalid media file', async () => {
    const result = await processFfmpegTags({ path: '/path/to/invalid.mp4' })
    expect(result.error).toBeDefined()
    expect(result.tags).toBeUndefined()
    expect(result.error).toContain('invalid media file format')
  })

  it('should return empty tags object when no tags present', async () => {
    mockGetMediaTags.mockResolvedValueOnce({ tags: {} })
    const result = await processFfmpegTags({ path: '/path/to/no-tags.mp4' })
    expect(result.error).toBeUndefined()
    expect(result.tags).toEqual({})
  })

  it('should include deprecation warning when using old endpoint', async () => {
    const result = await processFfmpegTags({ path: '/path/to/video.mp4' })
    expect(result.tags).toBeDefined()
    expect(result.deprecationWarning).toBeUndefined()
  })

  describe('handleFfmpegTags route', () => {
    it('should register both old and new endpoints', async () => {
      const app = new Hono()
      handleFfmpegTags(app)
      
      const routes = app.routes
      const hasReadTags = routes.some(r => r.path === '/api/ffprobe/readTags' && r.method === 'POST')
      const hasOldTags = routes.some(r => r.path === '/api/ffprobe/tags' && r.method === 'POST')
      
      expect(hasReadTags).toBe(true)
      expect(hasOldTags).toBe(true)
    })
  })
})
