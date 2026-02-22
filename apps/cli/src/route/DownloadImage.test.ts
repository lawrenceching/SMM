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

  describe('getContentType', () => {
    it('should return correct content type for jpg', async () => {
      vi.mocked(allowRead).mockResolvedValue(true)
      vi.mocked(readFile).mockResolvedValue(Buffer.from('test'))

      const result = await doDownloadImage('file:///path/to/image.jpg')
      expect(result.headers.get('Content-Type')).toBe('image/jpeg')
    })

    it('should return correct content type for jpeg', async () => {
      vi.mocked(allowRead).mockResolvedValue(true)
      vi.mocked(readFile).mockResolvedValue(Buffer.from('test'))

      const result = await doDownloadImage('file:///path/to/image.jpeg')
      expect(result.headers.get('Content-Type')).toBe('image/jpeg')
    })

    it('should return correct content type for png', async () => {
      vi.mocked(allowRead).mockResolvedValue(true)
      vi.mocked(readFile).mockResolvedValue(Buffer.from('test'))

      const result = await doDownloadImage('file:///path/to/image.png')
      expect(result.headers.get('Content-Type')).toBe('image/png')
    })

    it('should return correct content type for gif', async () => {
      vi.mocked(allowRead).mockResolvedValue(true)
      vi.mocked(readFile).mockResolvedValue(Buffer.from('test'))

      const result = await doDownloadImage('file:///path/to/image.gif')
      expect(result.headers.get('Content-Type')).toBe('image/gif')
    })

    it('should return correct content type for webp', async () => {
      vi.mocked(allowRead).mockResolvedValue(true)
      vi.mocked(readFile).mockResolvedValue(Buffer.from('test'))

      const result = await doDownloadImage('file:///path/to/image.webp')
      expect(result.headers.get('Content-Type')).toBe('image/webp')
    })

    it('should return correct content type for svg', async () => {
      vi.mocked(allowRead).mockResolvedValue(true)
      vi.mocked(readFile).mockResolvedValue(Buffer.from('test'))

      const result = await doDownloadImage('file:///path/to/image.svg')
      expect(result.headers.get('Content-Type')).toBe('image/svg+xml')
    })

    it('should return correct content type for ico', async () => {
      vi.mocked(allowRead).mockResolvedValue(true)
      vi.mocked(readFile).mockResolvedValue(Buffer.from('test'))

      const result = await doDownloadImage('file:///path/to/image.ico')
      expect(result.headers.get('Content-Type')).toBe('image/x-icon')
    })

    it('should return correct content type for bmp', async () => {
      vi.mocked(allowRead).mockResolvedValue(true)
      vi.mocked(readFile).mockResolvedValue(Buffer.from('test'))

      const result = await doDownloadImage('file:///path/to/image.bmp')
      expect(result.headers.get('Content-Type')).toBe('image/bmp')
    })

    it('should return correct content type for avif', async () => {
      vi.mocked(allowRead).mockResolvedValue(true)
      vi.mocked(readFile).mockResolvedValue(Buffer.from('test'))

      const result = await doDownloadImage('file:///path/to/image.avif')
      expect(result.headers.get('Content-Type')).toBe('image/avif')
    })

    it('should return correct content type for apng', async () => {
      vi.mocked(allowRead).mockResolvedValue(true)
      vi.mocked(readFile).mockResolvedValue(Buffer.from('test'))

      const result = await doDownloadImage('file:///path/to/image.apng')
      expect(result.headers.get('Content-Type')).toBe('image/apng')
    })

    it('should default to image/jpeg for unknown extension', async () => {
      vi.mocked(allowRead).mockResolvedValue(true)
      vi.mocked(readFile).mockResolvedValue(Buffer.from('test'))

      const result = await doDownloadImage('file:///path/to/image.unknown')
      expect(result.headers.get('Content-Type')).toBe('image/jpeg')
    })

    it('should be case insensitive for extension', async () => {
      vi.mocked(allowRead).mockResolvedValue(true)
      vi.mocked(readFile).mockResolvedValue(Buffer.from('test'))

      const result = await doDownloadImage('file:///path/to/image.JPG')
      expect(result.headers.get('Content-Type')).toBe('image/jpeg')
    })
  })

  describe('downloadImageFromFile', () => {
    it('should successfully read allowed file', async () => {
      const mockBuffer = Buffer.from('fake image data')
      vi.mocked(allowRead).mockResolvedValue(true)
      vi.mocked(readFile).mockResolvedValue(mockBuffer)

      const result = await doDownloadImage('file:///path/to/image.jpg')
      
      expect(result.status).toBe(200)
      expect(allowRead).toHaveBeenCalledWith('/path/to/image.jpg')
      expect(readFile).toHaveBeenCalledWith('/path/to/image.jpg')
      expect(result.headers.get('Content-Type')).toBe('image/jpeg')
      expect(result.headers.get('Content-Length')).toBe(mockBuffer.length.toString())
    })

    it('should throw error when file is not allowed', async () => {
      vi.mocked(allowRead).mockResolvedValue(false)

      await expect(doDownloadImage('file:///path/to/image.jpg')).rejects.toThrow(
        'Permission denied: file /path/to/image.jpg is not allowed to be read'
      )
      expect(readFile).not.toHaveBeenCalled()
    })

    it('should decode URL-encoded file paths', async () => {
      const mockBuffer = Buffer.from('fake image data')
      vi.mocked(allowRead).mockResolvedValue(true)
      vi.mocked(readFile).mockResolvedValue(mockBuffer)

      const result = await doDownloadImage('file:///path/to/image%20with%20spaces.jpg')
      
      expect(result.status).toBe(200)
      expect(allowRead).toHaveBeenCalledWith('/path/to/image with spaces.jpg')
      expect(readFile).toHaveBeenCalledWith('/path/to/image with spaces.jpg')
    })

    it('should handle special characters in file paths', async () => {
      const mockBuffer = Buffer.from('fake image data')
      vi.mocked(allowRead).mockResolvedValue(true)
      vi.mocked(readFile).mockResolvedValue(mockBuffer)

      const result = await doDownloadImage('file:///path/to/%E5%9B%BE%E7%89%87.jpg')
      
      expect(result.status).toBe(200)
      expect(allowRead).toHaveBeenCalledWith('/path/to/图片.jpg')
    })

    it('should propagate readFile errors', async () => {
      vi.mocked(allowRead).mockResolvedValue(true)
      vi.mocked(readFile).mockRejectedValue(new Error('File not found'))

      await expect(doDownloadImage('file:///path/to/image.jpg')).rejects.toThrow('File not found')
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
