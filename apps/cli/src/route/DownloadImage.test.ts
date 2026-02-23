import { describe, it, expect, vi, beforeEach } from 'vitest'
import { doDownloadImage } from './DownloadImage'
import { allowRead } from '../utils/permission'
import { readFile } from 'fs/promises'

vi.mock('../utils/permission')
vi.mock('fs/promises')

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('DownloadImage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetAllMocks()
  })

  describe('normalizeUrl', () => {
    it('should convert protocol-relative URLs to https', async () => {
      vi.mocked(allowRead).mockResolvedValue(true)
      vi.mocked(readFile).mockResolvedValue(Buffer.from('test image data'))
      
      await expect(doDownloadImage('//example.com/image.jpg')).rejects.toThrow()
      
      expect(readFile).not.toHaveBeenCalled()
    })

    it('should keep http URLs unchanged', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn((key) => key === 'content-type' ? 'image/jpeg' : null),
        },
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
      })

      const result = await doDownloadImage('http://example.com/image.jpg')
      
      expect(result).toBeInstanceOf(Response)
      expect(mockFetch).toHaveBeenCalledWith('http://example.com/image.jpg', expect.any(Object))
    })

    it('should keep https URLs unchanged', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn((key) => key === 'content-type' ? 'image/png' : null),
        },
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
      })

      const result = await doDownloadImage('https://example.com/image.png')
      
      expect(result).toBeInstanceOf(Response)
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/image.png', expect.any(Object))
    })
  })

  describe('createImageResponse', () => {
    it('should create Response with correct headers for JPEG', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn((key) => key === 'content-type' ? 'image/jpeg' : null),
        },
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
      })

      const result = await doDownloadImage('https://example.com/image.jpg')
      
      expect(result.status).toBe(200)
      expect(result.headers.get('Content-Type')).toBe('image/jpeg')
      expect(result.headers.get('Cache-Control')).toBe('public, max-age=31536000')
      expect(result.headers.get('Content-Length')).toBe('10')
    })

    it('should create Response with correct headers for PNG', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn((key) => key === 'content-type' ? 'image/png' : null),
        },
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(20)),
      })

      const result = await doDownloadImage('https://example.com/image.png')
      
      expect(result.status).toBe(200)
      expect(result.headers.get('Content-Type')).toBe('image/png')
      expect(result.headers.get('Content-Length')).toBe('20')
    })

    it('should default to image/jpeg when content-type is missing', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn(() => null),
        },
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(5)),
      })

      const result = await doDownloadImage('https://example.com/image')
      
      expect(result.headers.get('Content-Type')).toBe('image/jpeg')
    })
  })

  describe('downloadImageFromWeb', () => {
    it('should successfully download image from http URL', async () => {
      const mockBuffer = new ArrayBuffer(100)
      mockFetch.mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn((key) => key === 'content-type' ? 'image/png' : null),
        },
        arrayBuffer: vi.fn().mockResolvedValue(mockBuffer),
      })

      const result = await doDownloadImage('http://example.com/image.png')
      
      expect(result.status).toBe(200)
      expect(mockFetch).toHaveBeenCalledWith(
        'http://example.com/image.png',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          }),
        })
      )
      expect(result.headers.get('Content-Type')).toBe('image/png')
      expect(result.headers.get('Content-Length')).toBe(mockBuffer.byteLength.toString())
    })

    it('should successfully download image from https URL', async () => {
      const mockBuffer = new ArrayBuffer(50)
      mockFetch.mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn((key) => key === 'content-type' ? 'image/webp' : null),
        },
        arrayBuffer: vi.fn().mockResolvedValue(mockBuffer),
      })

      const result = await doDownloadImage('https://example.com/image.webp')
      
      expect(result.status).toBe(200)
      expect(result.headers.get('Content-Type')).toBe('image/webp')
    })

    it('should throw error on HTTP error status', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      })

      await expect(doDownloadImage('https://example.com/notfound.jpg')).rejects.toThrow(
        'HTTP error! status: 404'
      )
    })

    it('should throw error on HTTP 500 status', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      })

      await expect(doDownloadImage('https://example.com/error.jpg')).rejects.toThrow(
        'HTTP error! status: 500'
      )
    })

    it('should propagate network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      await expect(doDownloadImage('https://example.com/image.jpg')).rejects.toThrow('Network error')
    })

    it('should use default content type when response has no content-type header', async () => {
      const mockBuffer = new ArrayBuffer(30)
      mockFetch.mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn(() => null),
        },
        arrayBuffer: vi.fn().mockResolvedValue(mockBuffer),
      })

      const result = await doDownloadImage('https://example.com/image.jpg')
      
      expect(result.headers.get('Content-Type')).toBe('image/jpeg')
    })
  })

  describe('doDownloadImage', () => {
    it('should route file:// URLs to file handler', async () => {
      vi.mocked(allowRead).mockResolvedValue(true)
      vi.mocked(readFile).mockResolvedValue(Buffer.from('test'))

      const result = await doDownloadImage('file:///path/to/image.jpg')
      
      expect(result.status).toBe(200)
      expect(allowRead).toHaveBeenCalled()
      expect(readFile).toHaveBeenCalled()
    })

    it('should route http:// URLs to web handler', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn((key) => key === 'content-type' ? 'image/jpeg' : null),
        },
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
      })

      const result = await doDownloadImage('http://example.com/image.jpg')
      
      expect(result.status).toBe(200)
      expect(mockFetch).toHaveBeenCalled()
    })

    it('should route https:// URLs to web handler', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn((key) => key === 'content-type' ? 'image/jpeg' : null),
        },
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
      })

      const result = await doDownloadImage('https://example.com/image.jpg')
      
      expect(result.status).toBe(200)
      expect(mockFetch).toHaveBeenCalled()
    })

    it('should route protocol-relative URLs to web handler', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn((key) => key === 'content-type' ? 'image/jpeg' : null),
        },
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
      })

      const result = await doDownloadImage('//example.com/image.jpg')
      
      expect(result.status).toBe(200)
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/image.jpg', expect.any(Object))
    })

    it('should throw error for invalid URL protocol', async () => {
      await expect(doDownloadImage('ftp://example.com/image.jpg')).rejects.toThrow(
        'Invalid image URL: ftp://example.com/image.jpg. Must be http://, https://, protocol-relative (//), or file://'
      )
    })

    it('should throw error for empty string URL', async () => {
      await expect(doDownloadImage('')).rejects.toThrow(
        'Invalid image URL: . Must be http://, https://, protocol-relative (//), or file://'
      )
    })

    it('should throw error for data:// URL', async () => {
      await expect(doDownloadImage('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD')).rejects.toThrow(
        'Invalid image URL:'
      )
    })

    it('should handle and log errors from file handler', async () => {
      vi.mocked(allowRead).mockRejectedValue(new Error('Permission check failed'))

      await expect(doDownloadImage('file:///path/to/image.jpg')).rejects.toThrow('Permission check failed')
    })

    it('should handle and log errors from web handler', async () => {
      mockFetch.mockRejectedValue(new Error('Connection failed'))

      await expect(doDownloadImage('https://example.com/image.jpg')).rejects.toThrow('Connection failed')
    })

    it('should preserve error message in thrown error', async () => {
      const customError = new Error('Custom error message')
      vi.mocked(allowRead).mockRejectedValue(customError)

      await expect(doDownloadImage('file:///path/to/image.jpg')).rejects.toThrow('Custom error message')
    })

    it('should handle URLs with query parameters', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn((key) => key === 'content-type' ? 'image/jpeg' : null),
        },
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
      })

      const result = await doDownloadImage('https://example.com/image.jpg?width=200&height=200')
      
      expect(result.status).toBe(200)
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/image.jpg?width=200&height=200', expect.any(Object))
    })

    it('should handle URLs with fragments', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn((key) => key === 'content-type' ? 'image/jpeg' : null),
        },
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
      })

      const result = await doDownloadImage('https://example.com/image.jpg#section')
      
      expect(result.status).toBe(200)
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/image.jpg#section', expect.any(Object))
    })
  })
})
