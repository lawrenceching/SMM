import { describe, it, expect } from 'vitest'
import {
  validateDownloadUrl,
  ALLOWED_HOSTNAMES,
  URL_EMPTY,
  URL_INVALID,
  URL_PLATFORM_NOT_ALLOWED,
} from './download-video-validators'

describe('validateDownloadUrl', () => {
  describe('empty URL', () => {
    it('should reject empty string', () => {
      const result = validateDownloadUrl('')
      expect(result).toEqual({ valid: false, error: URL_EMPTY })
    })

    it('should reject whitespace-only string', () => {
      const result = validateDownloadUrl('   ')
      expect(result).toEqual({ valid: false, error: URL_EMPTY })
    })
  })

  describe('invalid URL format', () => {
    it('should reject a string without protocol', () => {
      const result = validateDownloadUrl('not-a-url')
      expect(result).toEqual({ valid: false, error: URL_INVALID })
    })

    it('should reject malformed URL', () => {
      const result = validateDownloadUrl('http://')
      expect(result).toEqual({ valid: false, error: URL_INVALID })
    })

    it('should reject URL with invalid protocol', () => {
      const result = validateDownloadUrl('http1s://www.bilibili.com/video/BV1TyZqBcEJb')
      expect(result).toEqual({ valid: false, error: URL_INVALID })
    })

    it('should reject URL with no hostname', () => {
      // https:// or http:// with no host parses but has empty hostname
      const result = validateDownloadUrl('https://')
      expect(result).toEqual({ valid: false, error: URL_INVALID })
    })

    it('should reject ftp protocol', () => {
      const result = validateDownloadUrl('ftp://www.youtube.com/video')
      expect(result).toEqual({ valid: false, error: URL_INVALID })
    })
  })

  describe('allowed platforms', () => {
    it('should accept YouTube URL', () => {
      const result = validateDownloadUrl('https://www.youtube.com/watch?v=abc123')
      expect(result).toEqual({ valid: true })
    })

    it('should accept YouTube short URL', () => {
      const result = validateDownloadUrl('https://youtu.be/abc123')
      expect(result).toEqual({ valid: true })
    })

    it('should accept YouTube Music URL', () => {
      const result = validateDownloadUrl('https://music.youtube.com/watch?v=abc123')
      expect(result).toEqual({ valid: true })
    })

    it('should accept mobile YouTube URL', () => {
      const result = validateDownloadUrl('https://m.youtube.com/watch?v=abc123')
      expect(result).toEqual({ valid: true })
    })

    it('should accept Bilibili URL', () => {
      const result = validateDownloadUrl('https://www.bilibili.com/video/BV1xx411c7mD')
      expect(result).toEqual({ valid: true })
    })

    it('should accept Bilibili short URL', () => {
      const result = validateDownloadUrl('https://b23.tv/abc123')
      expect(result).toEqual({ valid: true })
    })

    it('should accept mobile Bilibili URL', () => {
      const result = validateDownloadUrl('https://m.bilibili.com/video/BV1xx411c7mD')
      expect(result).toEqual({ valid: true })
    })
  })

  describe('disallowed platforms', () => {
    it('should reject Vimeo URL', () => {
      const result = validateDownloadUrl('https://vimeo.com/123456')
      expect(result).toEqual({ valid: false, error: URL_PLATFORM_NOT_ALLOWED })
    })

    it('should reject Dailymotion URL', () => {
      const result = validateDownloadUrl('https://www.dailymotion.com/video/x7tgad0')
      expect(result).toEqual({ valid: false, error: URL_PLATFORM_NOT_ALLOWED })
    })

    it('should reject generic URL', () => {
      const result = validateDownloadUrl('https://example.com/video.mp4')
      expect(result).toEqual({ valid: false, error: URL_PLATFORM_NOT_ALLOWED })
    })
  })

  describe('ALLOWED_HOSTNAMES', () => {
    it('should contain YouTube hostnames', () => {
      expect(ALLOWED_HOSTNAMES).toContain('youtube.com')
      expect(ALLOWED_HOSTNAMES).toContain('www.youtube.com')
      expect(ALLOWED_HOSTNAMES).toContain('m.youtube.com')
      expect(ALLOWED_HOSTNAMES).toContain('youtu.be')
      expect(ALLOWED_HOSTNAMES).toContain('music.youtube.com')
    })

    it('should contain Bilibili hostnames', () => {
      expect(ALLOWED_HOSTNAMES).toContain('bilibili.com')
      expect(ALLOWED_HOSTNAMES).toContain('www.bilibili.com')
      expect(ALLOWED_HOSTNAMES).toContain('m.bilibili.com')
      expect(ALLOWED_HOSTNAMES).toContain('b23.tv')
    })
  })
})
