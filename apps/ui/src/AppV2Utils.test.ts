import { describe, it, expect } from 'vitest'
import { getTmdbIdFromFolderName } from './AppV2Utils'

describe('getTmdbIdFromFolderName', () => {

  it('use case 1', () => {
    const result = getTmdbIdFromFolderName('爱杀宝贝 (2012) [tmdbid=73598]')
    expect(result).toBe('73598')
  })

  describe('valid patterns with parentheses', () => {
    it('should extract TMDB ID from pattern (tmdbid=123456)', () => {
      const result = getTmdbIdFromFolderName('TV Show (tmdbid=123456)')
      expect(result).toBe('123456')
    })

    it('should extract TMDB ID from pattern (tmdbid=1)', () => {
      const result = getTmdbIdFromFolderName('Movie (tmdbid=1)')
      expect(result).toBe('1')
    })

    it('should extract TMDB ID with extra spaces in pattern ( tmdbid = 123456 )', () => {
      const result = getTmdbIdFromFolderName('TV Show ( tmdbid = 123456 )')
      expect(result).toBe('123456')
    })

    it('should extract TMDB ID from full folder path (tmdbid=123456)', () => {
      const result = getTmdbIdFromFolderName('/path/to/TV Show (tmdbid=123456)')
      expect(result).toBe('123456')
    })
  })

  describe('valid patterns with curly braces', () => {
    it('should extract TMDB ID from pattern {tmdbid=123456}', () => {
      const result = getTmdbIdFromFolderName('TV Show {tmdbid=123456}')
      expect(result).toBe('123456')
    })

    it('should extract TMDB ID from pattern {tmdbid=1}', () => {
      const result = getTmdbIdFromFolderName('Movie {tmdbid=1}')
      expect(result).toBe('1')
    })

    it('should extract TMDB ID with extra spaces in pattern { tmdbid = 123456 }', () => {
      const result = getTmdbIdFromFolderName('TV Show { tmdbid = 123456 }')
      expect(result).toBe('123456')
    })

    it('should extract TMDB ID from full folder path {tmdbid=123456}', () => {
      const result = getTmdbIdFromFolderName('/path/to/TV Show {tmdbid=123456}')
      expect(result).toBe('123456')
    })
  })

  describe('case insensitivity', () => {
    it('should extract TMDB ID with uppercase T (tmdbid=123456)', () => {
      const result = getTmdbIdFromFolderName('TV Show (Tmdbid=123456)')
      expect(result).toBe('123456')
    })

    it('should extract TMDB ID with all uppercase (TMDBID=123456)', () => {
      const result = getTmdbIdFromFolderName('TV Show (TMDBID=123456)')
      expect(result).toBe('123456')
    })

    it('should extract TMDB ID with mixed case (TmDbId=123456)', () => {
      const result = getTmdbIdFromFolderName('TV Show (TmDbId=123456)')
      expect(result).toBe('123456')
    })

    it('should extract TMDB ID with curly braces and mixed case {tMdBiD=123456}', () => {
      const result = getTmdbIdFromFolderName('TV Show {tMdBiD=123456}')
      expect(result).toBe('123456')
    })
  })

  describe('complex folder names', () => {
    it('should extract TMDB ID from folder with year and TMDB ID', () => {
      const result = getTmdbIdFromFolderName('TV Show (2020) (tmdbid=123456)')
      expect(result).toBe('123456')
    })

    it('should extract TMDB ID from folder with quality tag', () => {
      const result = getTmdbIdFromFolderName('TV Show [1080p] (tmdbid=123456)')
      expect(result).toBe('123456')
    })

    it('should extract TMDB ID from folder with multiple parentheses', () => {
      const result = getTmdbIdFromFolderName('TV Show (2020) (Season 1) (tmdbid=123456)')
      expect(result).toBe('123456')
    })

    it('should extract TMDB ID from folder with special characters in name', () => {
      const result = getTmdbIdFromFolderName('TV Show: The Beginning (tmdbid=123456)')
      expect(result).toBe('123456')
    })

    it('should extract TMDB ID from folder with underscores', () => {
      const result = getTmdbIdFromFolderName('TV_Show_Season_1 (tmdbid=123456)')
      expect(result).toBe('123456')
    })

    it('should extract TMDB ID from folder with hyphens', () => {
      const result = getTmdbIdFromFolderName('TV-Show-Season-1 (tmdbid=123456)')
      expect(result).toBe('123456')
    })
  })

  describe('large TMDB IDs', () => {
    it('should extract large TMDB ID (7 digits)', () => {
      const result = getTmdbIdFromFolderName('TV Show (tmdbid=1234567)')
      expect(result).toBe('1234567')
    })

    it('should extract very large TMDB ID (8 digits)', () => {
      const result = getTmdbIdFromFolderName('Movie {tmdbid=12345678}')
      expect(result).toBe('12345678')
    })
  })

  describe('invalid patterns', () => {
    it('should return null when no TMDB ID pattern is present', () => {
      const result = getTmdbIdFromFolderName('TV Show')
      expect(result).toBeNull()
    })

    it('should return null when TMDB ID is missing (tmdbid=)', () => {
      const result = getTmdbIdFromFolderName('TV Show (tmdbid=)')
      expect(result).toBeNull()
    })

    it('should return null when TMDB ID contains letters (tmdbid=abc)', () => {
      const result = getTmdbIdFromFolderName('TV Show (tmdbid=abc)')
      expect(result).toBeNull()
    })

    it('should return null when TMDB ID contains mixed alphanumeric (tmdbid=12abc34)', () => {
      const result = getTmdbIdFromFolderName('TV Show {tmdbid=12abc34}')
      expect(result).toBeNull()
    })

    it('should return null when pattern has only opening parenthesis', () => {
      const result = getTmdbIdFromFolderName('TV Show (tmdbid=123456')
      expect(result).toBeNull()
    })

    it('should return null when pattern has only opening curly brace', () => {
      const result = getTmdbIdFromFolderName('TV Show {tmdbid=123456')
      expect(result).toBeNull()
    })

    it('should return null when pattern has only closing parenthesis', () => {
      const result = getTmdbIdFromFolderName('TV Show tmdbid=123456)')
      expect(result).toBeNull()
    })

    it('should return null when pattern has only closing curly brace', () => {
      const result = getTmdbIdFromFolderName('TV Show tmdbid=123456}')
      expect(result).toBeNull()
    })

    it('should extract TMDB ID from pattern [tmdbid=123456]', () => {
      const result = getTmdbIdFromFolderName('TV Show [tmdbid=123456]')
      expect(result).toBe('123456')
    })

    it('should return null when using angle brackets <tmdbid=123456>', () => {
      const result = getTmdbIdFromFolderName('TV Show <tmdbid=123456>')
      expect(result).toBeNull()
    })

    it('should return null when keyword is misspelled', () => {
      const result = getTmdbIdFromFolderName('TV Show (tmdbiid=123456)')
      expect(result).toBeNull()
    })

    it('should return null when there are no delimiters', () => {
      const result = getTmdbIdFromFolderName('TV Show tmdbid=123456')
      expect(result).toBeNull()
    })

    it('should return null for empty string', () => {
      const result = getTmdbIdFromFolderName('')
      expect(result).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('should extract first TMDB ID when multiple patterns exist', () => {
      const result = getTmdbIdFromFolderName('TV Show (tmdbid=123456) (tmdbid=789012)')
      expect(result).toBe('123456')
    })

    it('should extract TMDB ID with leading zeros (tmdbid=00123)', () => {
      const result = getTmdbIdFromFolderName('TV Show (tmdbid=00123)')
      expect(result).toBe('00123')
    })

    it('should extract TMDB ID from pattern with no spaces around equals', () => {
      const result = getTmdbIdFromFolderName('TV Show (tmdbid=123456)')
      expect(result).toBe('123456')
    })

    it('should extract TMDB ID from pattern with spaces before and after ID', () => {
      const result = getTmdbIdFromFolderName('TV Show (tmdbid= 123456 )')
      expect(result).toBe('123456')
    })

    it('should work with Unicode characters in folder name', () => {
      const result = getTmdbIdFromFolderName('电视剧 (tmdbid=123456)')
      expect(result).toBe('123456')
    })

    it('should work with emojis in folder name', () => {
      const result = getTmdbIdFromFolderName('TV Show 📺 (tmdbid=123456)')
      expect(result).toBe('123456')
    })
  })
})
