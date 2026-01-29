import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { preProcessMediaFolder } from './preProcessMediaFolder'
import type { TMDBTVShow, TMDBMovie } from '@core/types'

// Mock the recognition functions
vi.mock('./recognizeMediaFolderByNFO', () => ({
  tryToRecognizeMediaFolderByNFO: vi.fn(),
}))

vi.mock('./recognizeMediaFolderByTmdbIdInFolderName', () => ({
  tryToRecognizeMediaFolderByTmdbIdInFolderName: vi.fn(),
}))

vi.mock('./recognizeMediaFolderByFolderName', () => ({
  tryToRecognizeMediaFolderByFolderName: vi.fn(),
}))

import { tryToRecognizeMediaFolderByNFO } from './recognizeMediaFolderByNFO'
import { tryToRecognizeMediaFolderByTmdbIdInFolderName } from './recognizeMediaFolderByTmdbIdInFolderName'
import { tryToRecognizeMediaFolderByFolderName } from './recognizeMediaFolderByFolderName'

describe('preProcessMediaFolder', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
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

  it('should return success result when NFO recognition succeeds', async () => {
    const folderPath = '/media/tvshows/Test Show'
    
    vi.mocked(tryToRecognizeMediaFolderByNFO).mockResolvedValue({
      success: true,
      type: 'tv',
      tmdbTvShow: mockTvShow,
    })

    const result = await preProcessMediaFolder(folderPath)

    expect(result.success).toBe(true)
    expect(result.type).toBe('tv')
    expect(result.tmdbTvShow).toEqual(mockTvShow)
    expect(tryToRecognizeMediaFolderByNFO).toHaveBeenCalledWith(folderPath, undefined)
    expect(tryToRecognizeMediaFolderByTmdbIdInFolderName).not.toHaveBeenCalled()
    expect(tryToRecognizeMediaFolderByFolderName).not.toHaveBeenCalled()
    
    expect(consoleLogSpy).toHaveBeenCalledWith(
      `[preprocessMediaFolder] successfully recognized media folder by NFO: ${mockTvShow.name} ${mockTvShow.id}`
    )
  })

  it('should return success result when TMDB ID recognition succeeds after NFO fails', async () => {
    const folderPath = '/media/tvshows/Test Show (12345)'
    
    vi.mocked(tryToRecognizeMediaFolderByNFO).mockResolvedValue({
      success: false,
    })

    vi.mocked(tryToRecognizeMediaFolderByTmdbIdInFolderName).mockResolvedValue({
      success: true,
      type: 'tv',
      tmdbTvShow: mockTvShow,
    })

    const result = await preProcessMediaFolder(folderPath)

    expect(result.success).toBe(true)
    expect(result.type).toBe('tv')
    expect(result.tmdbTvShow).toEqual(mockTvShow)
    expect(tryToRecognizeMediaFolderByNFO).toHaveBeenCalledWith(folderPath, undefined)
    expect(tryToRecognizeMediaFolderByTmdbIdInFolderName).toHaveBeenCalledWith(folderPath, undefined)
    expect(tryToRecognizeMediaFolderByFolderName).not.toHaveBeenCalled()
    
    expect(consoleLogSpy).toHaveBeenCalledWith(
      `[preprocessMediaFolder] successfully recognized media folder by TMDB ID in folder name: ${mockTvShow.name} ${mockTvShow.id}`
    )
  })

  it('should return success result when folder name recognition succeeds after NFO and TMDB ID fail', async () => {
    const folderPath = '/media/tvshows/Test Show'
    
    vi.mocked(tryToRecognizeMediaFolderByNFO).mockResolvedValue({
      success: false,
    })

    vi.mocked(tryToRecognizeMediaFolderByTmdbIdInFolderName).mockResolvedValue({
      success: false,
    })

    vi.mocked(tryToRecognizeMediaFolderByFolderName).mockResolvedValue({
      success: true,
      type: 'tv',
      tmdbTvShow: mockTvShow,
    })

    const result = await preProcessMediaFolder(folderPath)

    expect(result.success).toBe(true)
    expect(result.type).toBe('tv')
    expect(result.tmdbTvShow).toEqual(mockTvShow)
    expect(tryToRecognizeMediaFolderByNFO).toHaveBeenCalledWith(folderPath, undefined)
    expect(tryToRecognizeMediaFolderByTmdbIdInFolderName).toHaveBeenCalledWith(folderPath, undefined)
    expect(tryToRecognizeMediaFolderByFolderName).toHaveBeenCalledWith(folderPath, 'zh-CN')
    
    expect(consoleLogSpy).toHaveBeenCalledWith(
      `[preprocessMediaFolder] successfully recognized media folder by folder name: ${mockTvShow.name} ${mockTvShow.id}`
    )
  })

  it('should return success result for movie when folder name recognition succeeds', async () => {
    const folderPath = '/media/movies/Test Movie'
    
    vi.mocked(tryToRecognizeMediaFolderByNFO).mockResolvedValue({
      success: false,
    })

    vi.mocked(tryToRecognizeMediaFolderByTmdbIdInFolderName).mockResolvedValue({
      success: false,
    })

    vi.mocked(tryToRecognizeMediaFolderByFolderName).mockResolvedValue({
      success: true,
      type: 'movie',
      tmdbMovie: mockMovie,
    })

    const result = await preProcessMediaFolder(folderPath)

    expect(result.success).toBe(true)
    expect(result.type).toBe('movie')
    expect(result.tmdbMovie).toEqual(mockMovie)
    expect(tryToRecognizeMediaFolderByNFO).toHaveBeenCalledWith(folderPath, undefined)
    expect(tryToRecognizeMediaFolderByTmdbIdInFolderName).toHaveBeenCalledWith(folderPath, undefined)
    expect(tryToRecognizeMediaFolderByFolderName).toHaveBeenCalledWith(folderPath, 'zh-CN')
  })

  it('should return failure result when all recognition methods fail', async () => {
    const folderPath = '/media/unknown/Folder'
    
    vi.mocked(tryToRecognizeMediaFolderByNFO).mockResolvedValue({
      success: false,
    })

    vi.mocked(tryToRecognizeMediaFolderByTmdbIdInFolderName).mockResolvedValue({
      success: false,
    })

    vi.mocked(tryToRecognizeMediaFolderByFolderName).mockResolvedValue({
      success: false,
    })

    const result = await preProcessMediaFolder(folderPath)

    expect(result.success).toBe(false)
    expect(result.type).toBeUndefined()
    expect(tryToRecognizeMediaFolderByNFO).toHaveBeenCalled()
    expect(tryToRecognizeMediaFolderByTmdbIdInFolderName).toHaveBeenCalled()
    expect(tryToRecognizeMediaFolderByFolderName).toHaveBeenCalled()
  })

  it('should continue to TMDB ID recognition when NFO recognition throws an error', async () => {
    const folderPath = '/media/tvshows/Test Show (12345)'
    const testError = new Error('NFO recognition failed')
    
    vi.mocked(tryToRecognizeMediaFolderByNFO).mockRejectedValue(testError)

    vi.mocked(tryToRecognizeMediaFolderByTmdbIdInFolderName).mockResolvedValue({
      success: true,
      type: 'tv',
      tmdbTvShow: mockTvShow,
    })

    const result = await preProcessMediaFolder(folderPath)

    expect(result.success).toBe(true)
    expect(result.tmdbTvShow).toEqual(mockTvShow)
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `[preprocessMediaFolder] Error in tryToRecognizeMediaFolderByNFO:`,
      testError
    )
    
    expect(tryToRecognizeMediaFolderByTmdbIdInFolderName).toHaveBeenCalledWith(folderPath, undefined)
  })

  it('should continue to folder name recognition when TMDB ID recognition throws an error', async () => {
    const folderPath = '/media/tvshows/Test Show'
    const testError = new Error('TMDB ID recognition failed')
    
    vi.mocked(tryToRecognizeMediaFolderByNFO).mockResolvedValue({
      success: false,
    })

    vi.mocked(tryToRecognizeMediaFolderByTmdbIdInFolderName).mockRejectedValue(testError)

    vi.mocked(tryToRecognizeMediaFolderByFolderName).mockResolvedValue({
      success: true,
      type: 'tv',
      tmdbTvShow: mockTvShow,
    })

    const result = await preProcessMediaFolder(folderPath)

    expect(result.success).toBe(true)
    expect(result.tmdbTvShow).toEqual(mockTvShow)
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `[preprocessMediaFolder] Error in tryToRecognizeMediaFolderByTmdbIdInFolderName:`,
      testError
    )
    
    expect(tryToRecognizeMediaFolderByFolderName).toHaveBeenCalledWith(folderPath, 'zh-CN')
  })

  it('should return failure result when folder name recognition throws an error', async () => {
    const folderPath = '/media/unknown/Folder'
    const testError = new Error('Folder name recognition failed')
    
    vi.mocked(tryToRecognizeMediaFolderByNFO).mockResolvedValue({
      success: false,
    })

    vi.mocked(tryToRecognizeMediaFolderByTmdbIdInFolderName).mockResolvedValue({
      success: false,
    })

    vi.mocked(tryToRecognizeMediaFolderByFolderName).mockRejectedValue(testError)

    const result = await preProcessMediaFolder(folderPath)

    expect(result.success).toBe(false)
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `[preprocessMediaFolder] Error in tryToRecognizeMediaFolderByFolderName:`,
      testError
    )
  })

  it('should pass abort signal to NFO recognition', async () => {
    const folderPath = '/media/tvshows/Test Show'
    const abortController = new AbortController()
    const signal = abortController.signal
    
    vi.mocked(tryToRecognizeMediaFolderByNFO).mockResolvedValue({
      success: true,
      type: 'tv',
      tmdbTvShow: mockTvShow,
    })

    await preProcessMediaFolder(folderPath, signal)

    expect(tryToRecognizeMediaFolderByNFO).toHaveBeenCalledWith(folderPath, signal)
  })

  it('should pass abort signal to TMDB ID recognition when NFO fails', async () => {
    const folderPath = '/media/tvshows/Test Show (12345)'
    const abortController = new AbortController()
    const signal = abortController.signal
    
    vi.mocked(tryToRecognizeMediaFolderByNFO).mockResolvedValue({
      success: false,
    })

    vi.mocked(tryToRecognizeMediaFolderByTmdbIdInFolderName).mockResolvedValue({
      success: true,
      type: 'tv',
      tmdbTvShow: mockTvShow,
    })

    await preProcessMediaFolder(folderPath, signal)

    expect(tryToRecognizeMediaFolderByTmdbIdInFolderName).toHaveBeenCalledWith(folderPath, signal)
  })

  it('should log preprocessing start message', async () => {
    const folderPath = '/media/tvshows/Test Show'
    
    vi.mocked(tryToRecognizeMediaFolderByNFO).mockResolvedValue({
      success: false,
    })

    vi.mocked(tryToRecognizeMediaFolderByTmdbIdInFolderName).mockResolvedValue({
      success: false,
    })

    vi.mocked(tryToRecognizeMediaFolderByFolderName).mockResolvedValue({
      success: false,
    })

    await preProcessMediaFolder(folderPath)

    expect(consoleLogSpy).toHaveBeenCalledWith(
      `[preprocessMediaFolder] preprocess media folder: ${folderPath}`
    )
  })

  it('should handle multiple consecutive errors without crashing', async () => {
    const folderPath = '/media/unknown/Folder'
    const testError1 = new Error('Error 1')
    const testError2 = new Error('Error 2')
    const testError3 = new Error('Error 3')
    
    vi.mocked(tryToRecognizeMediaFolderByNFO).mockRejectedValue(testError1)
    vi.mocked(tryToRecognizeMediaFolderByTmdbIdInFolderName).mockRejectedValue(testError2)
    vi.mocked(tryToRecognizeMediaFolderByFolderName).mockRejectedValue(testError3)

    const result = await preProcessMediaFolder(folderPath)

    expect(result.success).toBe(false)
    expect(consoleErrorSpy).toHaveBeenCalledTimes(3)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `[preprocessMediaFolder] Error in tryToRecognizeMediaFolderByNFO:`,
      testError1
    )
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `[preprocessMediaFolder] Error in tryToRecognizeMediaFolderByTmdbIdInFolderName:`,
      testError2
    )
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `[preprocessMediaFolder] Error in tryToRecognizeMediaFolderByFolderName:`,
      testError3
    )
  })

  it('should not call subsequent recognition methods after NFO succeeds', async () => {
    const folderPath = '/media/tvshows/Test Show'
    
    vi.mocked(tryToRecognizeMediaFolderByNFO).mockResolvedValue({
      success: true,
      type: 'tv',
      tmdbTvShow: mockTvShow,
    })

    await preProcessMediaFolder(folderPath)

    expect(tryToRecognizeMediaFolderByNFO).toHaveBeenCalledTimes(1)
    expect(tryToRecognizeMediaFolderByTmdbIdInFolderName).not.toHaveBeenCalled()
    expect(tryToRecognizeMediaFolderByFolderName).not.toHaveBeenCalled()
  })

  it('should not call folder name recognition after TMDB ID succeeds', async () => {
    const folderPath = '/media/tvshows/Test Show (12345)'
    
    vi.mocked(tryToRecognizeMediaFolderByNFO).mockResolvedValue({
      success: false,
    })

    vi.mocked(tryToRecognizeMediaFolderByTmdbIdInFolderName).mockResolvedValue({
      success: true,
      type: 'tv',
      tmdbTvShow: mockTvShow,
    })

    await preProcessMediaFolder(folderPath)

    expect(tryToRecognizeMediaFolderByNFO).toHaveBeenCalledTimes(1)
    expect(tryToRecognizeMediaFolderByTmdbIdInFolderName).toHaveBeenCalledTimes(1)
    expect(tryToRecognizeMediaFolderByFolderName).not.toHaveBeenCalled()
  })
})
