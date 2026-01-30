import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { tryToRecognizeMediaFolderByFolderName } from './recognizeMediaFolderByFolderName'
import type { TMDBMovie, TMDBTVShow } from '@core/types'

// Mock the dependencies
vi.mock('@/api/tmdb', () => ({
  searchTmdb: vi.fn(),
}))

vi.mock('./path', () => ({
  basename: vi.fn(),
}))

import { searchTmdb } from '@/api/tmdb'
import { basename } from './path'

describe('tryToRecognizeMediaFolderByFolderName', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  let consoleLogSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    consoleLogSpy.mockRestore()
  })

  const mockTvShow: TMDBTVShow = {
    id: 12345,
    name: 'Test TV Show',
    overview: 'A test TV show',
    first_air_date: '2020-01-01',
    poster_path: '/poster.jpg',
    backdrop_path: '/backdrop.jpg',
    vote_average: 8.5,
    vote_count: 100,
    genre_ids: [1, 2],
    origin_country: ['US'],
    original_name: 'Test TV Show',
    popularity: 100.5,
  }

  const mockMovie: TMDBMovie = {
    id: 67890,
    title: 'Test Movie',
    overview: 'A test movie',
    release_date: '2020-01-01',
    poster_path: '/poster.jpg',
    backdrop_path: '/backdrop.jpg',
    vote_average: 7.5,
    vote_count: 50,
    genre_ids: [1, 2],
    original_title: 'Test Movie',
    popularity: 75.5,
    adult: false,
    video: false,
  }

  it('should return success result when TV show name matches exactly', async () => {
    const folderPath = '/media/tvshows/Test TV Show'
    const folderName = 'Test TV Show'
    
    vi.mocked(basename).mockReturnValue(folderName)
    vi.mocked(searchTmdb)
      .mockResolvedValueOnce({
        results: [mockTvShow, { ...mockTvShow, id: 54321, name: 'Other TV Show' }],
        page: 1,
        total_pages: 1,
        total_results: 2,
        error: undefined,
      })
      .mockResolvedValueOnce({
        results: [],
        page: 1,
        total_pages: 1,
        total_results: 0,
        error: undefined,
      })

    const result = await tryToRecognizeMediaFolderByFolderName(folderPath, 'zh-CN')

    expect(result.success).toBe(true)
    expect(result.type).toBe('tv')
    expect(result.tmdbTvShow).toEqual(mockTvShow)
    expect(basename).toHaveBeenCalledWith(folderPath)
    expect(searchTmdb).toHaveBeenCalledTimes(2)
    expect(searchTmdb).toHaveBeenCalledWith(folderName, 'tv', 'zh-CN')
    expect(searchTmdb).toHaveBeenCalledWith(folderName, 'movie', 'zh-CN')
  })

  it('should return success result when movie title matches exactly', async () => {
    const folderPath = '/media/movies/Test Movie'
    const folderName = 'Test Movie'
    
    vi.mocked(basename).mockReturnValue(folderName)
    vi.mocked(searchTmdb)
      .mockResolvedValueOnce({
        results: [],
        page: 1,
        total_pages: 1,
        total_results: 0,
        error: undefined,
      })
      .mockResolvedValueOnce({
        results: [mockMovie, { ...mockMovie, id: 54321, title: 'Other Movie' }],
        page: 1,
        total_pages: 1,
        total_results: 2,
        error: undefined,
      })

    const result = await tryToRecognizeMediaFolderByFolderName(folderPath, 'zh-CN')

    expect(result.success).toBe(true)
    expect(result.type).toBe('movie')
    expect(result.tmdbMovie).toEqual(mockMovie)
    expect(searchTmdb).toHaveBeenCalledWith(folderName, 'tv', 'zh-CN')
    expect(searchTmdb).toHaveBeenCalledWith(folderName, 'movie', 'zh-CN')
  })

  it('should use default language en-US when not specified', async () => {
    const folderPath = '/media/tvshows/Test TV Show'
    const folderName = 'Test TV Show'
    
    vi.mocked(basename).mockReturnValue(folderName)
    vi.mocked(searchTmdb)
      .mockResolvedValueOnce({
        results: [mockTvShow],
        page: 1,
        total_pages: 1,
        total_results: 1,
        error: undefined,
      })
      .mockResolvedValueOnce({
        results: [],
        page: 1,
        total_pages: 1,
        total_results: 0,
        error: undefined,
      })

    await tryToRecognizeMediaFolderByFolderName(folderPath)

    expect(searchTmdb).toHaveBeenCalledWith(folderName, 'tv', 'en-US')
    expect(searchTmdb).toHaveBeenCalledWith(folderName, 'movie', 'en-US')
  })

  it('should return failure result when no TV show or movie matches', async () => {
    const folderPath = '/media/unknown/Folder Name'
    const folderName = 'Folder Name'
    
    vi.mocked(basename).mockReturnValue(folderName)
    vi.mocked(searchTmdb)
      .mockResolvedValueOnce({
        results: [
          { ...mockTvShow, name: 'Similar TV Show 1' },
          { ...mockTvShow, name: 'Similar TV Show 2' },
        ],
        page: 1,
        total_pages: 1,
        total_results: 2,
        error: undefined,
      })
      .mockResolvedValueOnce({
        results: [
          { ...mockMovie, title: 'Similar Movie 1' },
          { ...mockMovie, title: 'Similar Movie 2' },
        ],
        page: 1,
        total_pages: 1,
        total_results: 2,
        error: undefined,
      })

    const result = await tryToRecognizeMediaFolderByFolderName(folderPath)

    expect(result.success).toBe(false)
    expect(result.tmdbTvShow).toBeUndefined()
    expect(result.tmdbMovie).toBeUndefined()
  })

  it('should return failure result when folder name is undefined', async () => {
    const folderPath = '/media/unknown'
    
    vi.mocked(basename).mockReturnValue(undefined)

    const result = await tryToRecognizeMediaFolderByFolderName(folderPath)

    expect(result.success).toBe(false)
    expect(consoleErrorSpy).toHaveBeenCalledWith('[preprocessMediaFolder] folder name is undefined')
    expect(searchTmdb).not.toHaveBeenCalled()
  })

  it('should return failure result when TV search returns error', async () => {
    const folderPath = '/media/tvshows/Test TV Show'
    const folderName = 'Test TV Show'
    const tvError = 'API Error: TV search failed'
    
    vi.mocked(basename).mockReturnValue(folderName)
    vi.mocked(searchTmdb)
      .mockResolvedValueOnce({
        results: [],
        page: 1,
        total_pages: 1,
        total_results: 0,
        error: tvError,
      })
      .mockResolvedValueOnce({
        results: [mockMovie],
        page: 1,
        total_pages: 1,
        total_results: 1,
        error: undefined,
      })

    const result = await tryToRecognizeMediaFolderByFolderName(folderPath)

    expect(result.success).toBe(false)
    expect(consoleErrorSpy).toHaveBeenCalledWith('[tryToRecognizeMediaFolderByFolderName] TMDB search error:', {
      tvError: tvError,
      movieError: undefined,
    })
  })

  it('should return failure result when movie search returns error', async () => {
    const folderPath = '/media/movies/Test Movie'
    const folderName = 'Test Movie'
    const movieError = 'API Error: Movie search failed'
    
    vi.mocked(basename).mockReturnValue(folderName)
    vi.mocked(searchTmdb)
      .mockResolvedValueOnce({
        results: [],
        page: 1,
        total_pages: 1,
        total_results: 0,
        error: undefined,
      })
      .mockResolvedValueOnce({
        results: [],
        page: 1,
        total_pages: 1,
        total_results: 0,
        error: movieError,
      })

    const result = await tryToRecognizeMediaFolderByFolderName(folderPath)

    expect(result.success).toBe(false)
    expect(consoleErrorSpy).toHaveBeenCalledWith('[tryToRecognizeMediaFolderByFolderName] TMDB search error:', {
      tvError: undefined,
      movieError: movieError,
    })
  })

  it('should return failure result when both TV and movie searches return error', async () => {
    const folderPath = '/media/test/Test'
    const folderName = 'Test'
    const tvError = 'TV API Error'
    const movieError = 'Movie API Error'
    
    vi.mocked(basename).mockReturnValue(folderName)
    vi.mocked(searchTmdb)
      .mockResolvedValueOnce({
        results: [],
        page: 1,
        total_pages: 1,
        total_results: 0,
        error: tvError,
      })
      .mockResolvedValueOnce({
        results: [],
        page: 1,
        total_pages: 1,
        total_results: 0,
        error: movieError,
      })

    const result = await tryToRecognizeMediaFolderByFolderName(folderPath)

    expect(result.success).toBe(false)
    expect(consoleErrorSpy).toHaveBeenCalledWith('[tryToRecognizeMediaFolderByFolderName] TMDB search error:', {
      tvError: tvError,
      movieError: movieError,
    })
  })

  it('should log all TV show results', async () => {
    const folderPath = '/media/tvshows/No Match TV Show'
    const folderName = 'No Match TV Show'
    const tvShows = [
      mockTvShow,
      { ...mockTvShow, id: 54321, name: 'Other TV Show 1' },
      { ...mockTvShow, id: 54322, name: 'Other TV Show 2' },
    ]
    
    vi.mocked(basename).mockReturnValue(folderName)
    vi.mocked(searchTmdb)
      .mockResolvedValueOnce({
        results: tvShows,
        page: 1,
        total_pages: 1,
        total_results: tvShows.length,
        error: undefined,
      })
      .mockResolvedValueOnce({
        results: [],
        page: 1,
        total_pages: 1,
        total_results: 0,
        error: undefined,
      })

    await tryToRecognizeMediaFolderByFolderName(folderPath)

    // All TV shows are logged since none match
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[tryToRecognizeMediaFolderByFolderName] TV result: Test TV Show 12345'
    )
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[tryToRecognizeMediaFolderByFolderName] TV result: Other TV Show 1 54321'
    )
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[tryToRecognizeMediaFolderByFolderName] TV result: Other TV Show 2 54322'
    )
  })

  it('should log all movie results', async () => {
    const folderPath = '/media/movies/Test Movie'
    const folderName = 'Test Movie'
    const movies = [
      mockMovie,
      { ...mockMovie, id: 54321, title: 'Other Movie 1' },
      { ...mockMovie, id: 54322, title: 'Other Movie 2' },
    ]
    
    vi.mocked(basename).mockReturnValue(folderName)
    vi.mocked(searchTmdb)
      .mockResolvedValueOnce({
        results: [],
        page: 1,
        total_pages: 1,
        total_results: 0,
        error: undefined,
      })
      .mockResolvedValueOnce({
        results: movies,
        page: 1,
        total_pages: 1,
        total_results: movies.length,
        error: undefined,
      })

    await tryToRecognizeMediaFolderByFolderName(folderPath)

    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[tryToRecognizeMediaFolderByFolderName] Movie result: Test Movie 67890'
    )
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[tryToRecognizeMediaFolderByFolderName] Movie result: Test Movie 67890'
    )
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[tryToRecognizeMediaFolderByFolderName] Movie result: Other Movie 1 54321'
    )
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[tryToRecognizeMediaFolderByFolderName] Movie result: Other Movie 2 54322'
    )
  })

  it('should return failure result and log exception when searchTmdb throws error', async () => {
    const folderPath = '/media/test/Test'
    const folderName = 'Test'
    const testError = new Error('Network timeout')
    
    vi.mocked(basename).mockReturnValue(folderName)
    vi.mocked(searchTmdb).mockRejectedValue(testError)

    const result = await tryToRecognizeMediaFolderByFolderName(folderPath)

    expect(result.success).toBe(false)
    expect(consoleErrorSpy).toHaveBeenCalledWith('[tryToRecognizeMediaFolderByFolderName] Exception:', testError)
  })

  it('should handle case-sensitive matching for TV shows', async () => {
    const folderPath = '/media/tvshows/TEST TV SHOW'
    const folderName = 'TEST TV SHOW'
    
    vi.mocked(basename).mockReturnValue(folderName)
    vi.mocked(searchTmdb)
      .mockResolvedValueOnce({
        results: [
          mockTvShow, // 'Test TV Show' - should NOT match
          { ...mockTvShow, name: 'TEST TV SHOW', id: 54321 }, // Should match
        ],
        page: 1,
        total_pages: 1,
        total_results: 2,
        error: undefined,
      })
      .mockResolvedValueOnce({
        results: [],
        page: 1,
        total_pages: 1,
        total_results: 0,
        error: undefined,
      })

    const result = await tryToRecognizeMediaFolderByFolderName(folderPath)

    expect(result.success).toBe(true)
    expect(result.tmdbTvShow?.id).toBe(54321)
    expect(result.tmdbTvShow?.name).toBe('TEST TV SHOW')
  })

  it('should handle case-sensitive matching for movies', async () => {
    const folderPath = '/media/movies/TEST MOVIE'
    const folderName = 'TEST MOVIE'
    
    vi.mocked(basename).mockReturnValue(folderName)
    vi.mocked(searchTmdb)
      .mockResolvedValueOnce({
        results: [],
        page: 1,
        total_pages: 1,
        total_results: 0,
        error: undefined,
      })
      .mockResolvedValueOnce({
        results: [
          mockMovie, // 'Test Movie' - should NOT match
          { ...mockMovie, title: 'TEST MOVIE', id: 54321 }, // Should match
        ],
        page: 1,
        total_pages: 1,
        total_results: 2,
        error: undefined,
      })

    const result = await tryToRecognizeMediaFolderByFolderName(folderPath)

    expect(result.success).toBe(true)
    expect(result.tmdbMovie?.id).toBe(54321)
    expect(result.tmdbMovie?.title).toBe('TEST MOVIE')
  })

  it('should support ja-JP language', async () => {
    const folderPath = '/media/tvshows/テレビ番組'
    const folderName = 'テレビ番組'
    const mockJapaneseTvShow = {
      ...mockTvShow,
      name: folderName,
      original_name: folderName,
    }
    
    vi.mocked(basename).mockReturnValue(folderName)
    vi.mocked(searchTmdb)
      .mockResolvedValueOnce({
        results: [mockJapaneseTvShow],
        page: 1,
        total_pages: 1,
        total_results: 1,
        error: undefined,
      })
      .mockResolvedValueOnce({
        results: [],
        page: 1,
        total_pages: 1,
        total_results: 0,
        error: undefined,
      })

    const result = await tryToRecognizeMediaFolderByFolderName(folderPath, 'ja-JP')

    expect(result.success).toBe(true)
    expect(searchTmdb).toHaveBeenCalledWith(folderName, 'tv', 'ja-JP')
    expect(searchTmdb).toHaveBeenCalledWith(folderName, 'movie', 'ja-JP')
  })
})
