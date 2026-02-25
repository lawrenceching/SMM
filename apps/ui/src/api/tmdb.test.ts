import { describe, it, expect } from 'vitest'
import { getTMDBImageUrl } from './tmdb'

describe('getTMDBImageUrl', () => {
  describe('backdrop_path handling', () => {
    describe('null/undefined handling', () => {
      it('should return null when path is null', () => {
        expect(getTMDBImageUrl(null)).toBeNull()
      })

      it('should return null when path is undefined', () => {
        expect(getTMDBImageUrl(undefined)).toBeNull()
      })

      it('should return null when path is not provided', () => {
        expect(getTMDBImageUrl()).toBeNull()
      })
    })

    describe('empty/invalid input handling', () => {
      it('should return null when path is an empty string', () => {
        expect(getTMDBImageUrl('')).toBeNull()
      })

      it('should return null when path is whitespace only', () => {
        expect(getTMDBImageUrl('   ')).toBeNull()
      })

      it('should return null when path is a number', () => {
        expect(getTMDBImageUrl(123 as unknown as string)).toBeNull()
      })

      it('should return null when path is an object', () => {
        expect(getTMDBImageUrl({} as unknown as string)).toBeNull()
      })
    })

    describe('relative path handling (TMDB format)', () => {
      it('should construct URL for relative backdrop_path with default size', () => {
        const backdropPath = '/abc123backdrop.jpg'
        const result = getTMDBImageUrl(backdropPath)
        expect(result).toBe('https://image.tmdb.org/t/p/w500/abc123backdrop.jpg')
      })

      it('should construct URL for relative backdrop_path with w780 size', () => {
        const backdropPath = '/xyz789backdrop.jpg'
        const result = getTMDBImageUrl(backdropPath, 'w780')
        expect(result).toBe('https://image.tmdb.org/t/p/w780/xyz789backdrop.jpg')
      })

      it('should construct URL for relative backdrop_path with original size', () => {
        const backdropPath = '/originalbackdrop.jpg'
        const result = getTMDBImageUrl(backdropPath, 'original')
        expect(result).toBe('https://image.tmdb.org/t/p/original/originalbackdrop.jpg')
      })

      it('should handle backdrop_path with leading slash', () => {
        const backdropPath = '/backdrop.jpg'
        const result = getTMDBImageUrl(backdropPath, 'w780')
        expect(result).toBe('https://image.tmdb.org/t/p/w780/backdrop.jpg')
      })

      it('should trim whitespace from relative path', () => {
        const backdropPath = '  /backdrop.jpg  '
        const result = getTMDBImageUrl(backdropPath, 'w780')
        expect(result).toBe('https://image.tmdb.org/t/p/w780/backdrop.jpg')
      })
    })

    describe('absolute URL handling', () => {
      it('should return HTTPS URL directly without modification', () => {
        const backdropPath = 'https://example.com/backdrop.jpg'
        const result = getTMDBImageUrl(backdropPath, 'w780')
        expect(result).toBe('https://example.com/backdrop.jpg')
      })

      it('should return HTTP URL directly without modification', () => {
        const backdropPath = 'http://example.com/backdrop.jpg'
        const result = getTMDBImageUrl(backdropPath, 'w780')
        expect(result).toBe('http://example.com/backdrop.jpg')
      })

      it('should handle external HTTPS URL with various sizes', () => {
        const backdropPath = 'https://cdn.example.com/images/backdrop.png'
        const result = getTMDBImageUrl(backdropPath, 'original')
        expect(result).toBe('https://cdn.example.com/images/backdrop.png')
      })

      it('should trim whitespace from absolute URL', () => {
        const backdropPath = '  https://example.com/backdrop.jpg  '
        const result = getTMDBImageUrl(backdropPath, 'w780')
        expect(result).toBe('https://example.com/backdrop.jpg')
      })
    })

    describe('size parameter handling', () => {
      it('should use default w500 size when not specified', () => {
        const backdropPath = '/backdrop.jpg'
        const result = getTMDBImageUrl(backdropPath)
        expect(result).toContain('/w500/')
      })

      it('should work with all supported sizes', () => {
        const backdropPath = '/backdrop.jpg'
        const sizes = ['w200', 'w300', 'w500', 'w780', 'original'] as const

        sizes.forEach(size => {
          const result = getTMDBImageUrl(backdropPath, size)
          expect(result).toContain(`/p/${size}/`)
        })
      })
    })
  })
})
