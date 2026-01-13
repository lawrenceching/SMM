import { describe, it, expect } from 'vitest'
import { getTmdbIdFromFolderName } from './AppV2Utils'

describe('getTmdbIdFromFolderName', () => {
  it('should extract TMDB ID from folder name with parentheses', () => {
    const folderName = 'Breaking Bad (tmdbid=1396)'
    const result = getTmdbIdFromFolderName(folderName)
    expect(result).toBe('1396')
  })

  it('should extract TMDB ID from folder name with curly braces', () => {
    const folderName = 'Breaking Bad {tmdbid=1396}'
    const result = getTmdbIdFromFolderName(folderName)
    expect(result).toBe('1396')
  })

  it('should extract TMDB ID with spaces around equals sign', () => {
    const folderName = 'Show Name (tmdbid = 12345)'
    const result = getTmdbIdFromFolderName(folderName)
    expect(result).toBe('12345')
  })

  it('should extract TMDB ID with spaces inside parentheses', () => {
    const folderName = 'Show Name ( tmdbid=67890 )'
    const result = getTmdbIdFromFolderName(folderName)
    expect(result).toBe('67890')
  })

  it('should extract TMDB ID with large ID numbers', () => {
    const folderName = 'Show Name (tmdbid=999999999)'
    const result = getTmdbIdFromFolderName(folderName)
    expect(result).toBe('999999999')
  })

  it('should return null when no TMDB ID pattern is present', () => {
    const folderName = 'Breaking Bad'
    const result = getTmdbIdFromFolderName(folderName)
    expect(result).toBeNull()
  })

  it('should return null for empty folder name', () => {
    const folderName = ''
    const result = getTmdbIdFromFolderName(folderName)
    expect(result).toBeNull()
  })

  it('should return null for folder name with non-matching parentheses', () => {
    const folderName = 'Show Name (year=2024)'
    const result = getTmdbIdFromFolderName(folderName)
    expect(result).toBeNull()
  })

  it('should be case-insensitive for tmdbid keyword', () => {
    const result1 = getTmdbIdFromFolderName('Show (TMDBID=123)')
    const result2 = getTmdbIdFromFolderName('Show (TmDbId=456)')
    const result3 = getTmdbIdFromFolderName('Show (TMDBID=789)')
    expect(result1).toBe('123')
    expect(result2).toBe('456')
    expect(result3).toBe('789')
  })

  it('should extract TMDB ID when folder name has other content', () => {
    const folderName = 'The Walking Dead - Complete Series (tmdbid=1402)'
    const result = getTmdbIdFromFolderName(folderName)
    expect(result).toBe('1402')
  })
})
