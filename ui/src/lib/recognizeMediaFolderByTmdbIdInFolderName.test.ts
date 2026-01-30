import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { tryToRecognizeMediaFolderByTmdbIdInFolderName } from './recognizeMediaFolderByTmdbIdInFolderName'
import type { TMDBTVShowDetails } from '@core/types'

// Mock the dependencies
vi.mock('@/api/tmdb', () => ({
  getTvShowById: vi.fn(),
}))

vi.mock('./path', () => ({
  basename: vi.fn(),
}))

vi.mock('@/AppV2Utils', () => ({
  getTmdbIdFromFolderName: vi.fn(),
}))

import { getTvShowById } from '@/api/tmdb'
import { basename } from './path'
import { getTmdbIdFromFolderName } from '@/AppV2Utils'

describe('tryToRecognizeMediaFolderByTmdbIdInFolderName', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  const mockTvShow: TMDBTVShowDetails = {
    id: 12345,
    name: 'Test TV Show',
    original_name: 'Test TV Show',
    overview: 'A test TV show',
    first_air_date: '2020-01-01',
    poster_path: '/poster.jpg',
    backdrop_path: '/backdrop.jpg',
    vote_average: 8.5,
    vote_count: 100,
    genre_ids: [1, 2],
    origin_country: ['US'],
    popularity: 100.5,
    // TMDBTVShowDetails required properties
    number_of_seasons: 3,
    number_of_episodes: 30,
    seasons: [
      { id: 1, name: 'Season 1', season_number: 1, episode_count: 10, poster_path: null, air_date: '2020-01-01', overview: 'Season 1 overview' },
      { id: 2, name: 'Season 2', season_number: 2, episode_count: 10, poster_path: null, air_date: '2021-01-01', overview: 'Season 2 overview' },
      { id: 3, name: 'Season 3', season_number: 3, episode_count: 10, poster_path: null, air_date: '2022-01-01', overview: 'Season 3 overview' },
    ],
    status: 'Returning Series',
    type: 'Scripted',
    in_production: true,
    last_air_date: '2022-12-31',
    networks: [{ id: 1, name: 'Test Network', logo_path: '/logo.jpg' }],
    production_companies: [{ id: 1, name: 'Test Studio', logo_path: '/studio.jpg' }],
  }

  it('should return success result when TV show is found by TMDB ID', async () => {
    const folderPath = '/media/tvshows/Test Show (12345)'
    
    vi.mocked(basename).mockReturnValue('Test Show (12345)')
    vi.mocked(getTmdbIdFromFolderName).mockReturnValue('12345')
    vi.mocked(getTvShowById).mockResolvedValue({
      data: mockTvShow,
      error: undefined,
    })

    const result = await tryToRecognizeMediaFolderByTmdbIdInFolderName(folderPath)

    expect(result.success).toBe(true)
    expect(result.type).toBe('tv')
    expect(result.tmdbTvShow).toEqual(mockTvShow)
    expect(basename).toHaveBeenCalledWith(folderPath)
    expect(getTmdbIdFromFolderName).toHaveBeenCalledWith('Test Show (12345)')
    expect(getTvShowById).toHaveBeenCalledWith(12345, 'zh-CN', undefined)
  })

  it('should pass abort signal to getTvShowById', async () => {
    const folderPath = '/media/tvshows/Test Show (12345)'
    const abortController = new AbortController()
    const signal = abortController.signal
    
    vi.mocked(basename).mockReturnValue('Test Show (12345)')
    vi.mocked(getTmdbIdFromFolderName).mockReturnValue('12345')
    vi.mocked(getTvShowById).mockResolvedValue({
      data: mockTvShow,
      error: undefined,
    })

    const result = await tryToRecognizeMediaFolderByTmdbIdInFolderName(folderPath, signal)

    expect(result.success).toBe(true)
    expect(getTvShowById).toHaveBeenCalledWith(12345, 'zh-CN', signal)
  })

  it('should return failure result when folder name is undefined', async () => {
    const folderPath = '/media/unknown'
    
    vi.mocked(basename).mockReturnValue(undefined)

    const result = await tryToRecognizeMediaFolderByTmdbIdInFolderName(folderPath)

    expect(result.success).toBe(false)
    expect(consoleErrorSpy).toHaveBeenCalledWith('[preprocessMediaFolder] folder name is undefined')
    expect(getTmdbIdFromFolderName).not.toHaveBeenCalled()
    expect(getTvShowById).not.toHaveBeenCalled()
  })

  it('should return failure result when TMDB ID is null', async () => {
    const folderPath = '/media/tvshows/Test Show'
    
    vi.mocked(basename).mockReturnValue('Test Show')
    vi.mocked(getTmdbIdFromFolderName).mockReturnValue(null)

    const result = await tryToRecognizeMediaFolderByTmdbIdInFolderName(folderPath)

    expect(result.success).toBe(false)
    expect(consoleErrorSpy).toHaveBeenCalledWith('[preprocessMediaFolder] TMDB ID is null')
    expect(getTvShowById).not.toHaveBeenCalled()
  })

  it('should return failure result when TMDB ID is not a valid number', async () => {
    const folderPath = '/media/tvshows/Test Show (abc)'
    
    vi.mocked(basename).mockReturnValue('Test Show (abc)')
    vi.mocked(getTmdbIdFromFolderName).mockReturnValue('abc')

    const result = await tryToRecognizeMediaFolderByTmdbIdInFolderName(folderPath)

    expect(result.success).toBe(false)
    expect(consoleErrorSpy).toHaveBeenCalledWith('[preprocessMediaFolder] TMDB ID is not a valid number')
    expect(getTvShowById).not.toHaveBeenCalled()
  })

  it('should return failure result when TMDB ID is zero', async () => {
    const folderPath = '/media/tvshows/Test Show (0)'
    
    vi.mocked(basename).mockReturnValue('Test Show (0)')
    vi.mocked(getTmdbIdFromFolderName).mockReturnValue('0')

    const result = await tryToRecognizeMediaFolderByTmdbIdInFolderName(folderPath)

    expect(result.success).toBe(false)
    expect(consoleErrorSpy).toHaveBeenCalledWith('[preprocessMediaFolder] TMDB ID is not a valid number')
    expect(getTvShowById).not.toHaveBeenCalled()
  })

  it('should return failure result when TMDB ID is negative', async () => {
    const folderPath = '/media/tvshows/Test Show (-5)'
    
    vi.mocked(basename).mockReturnValue('Test Show (-5)')
    vi.mocked(getTmdbIdFromFolderName).mockReturnValue('-5')

    const result = await tryToRecognizeMediaFolderByTmdbIdInFolderName(folderPath)

    expect(result.success).toBe(false)
    expect(consoleErrorSpy).toHaveBeenCalledWith('[preprocessMediaFolder] TMDB ID is not a valid number')
    expect(getTvShowById).not.toHaveBeenCalled()
  })

  it('should return failure result when getTvShowById returns error', async () => {
    const folderPath = '/media/tvshows/Test Show (12345)'
    const apiError = 'API Error: Failed to fetch TV show'
    
    vi.mocked(basename).mockReturnValue('Test Show (12345)')
    vi.mocked(getTmdbIdFromFolderName).mockReturnValue('12345')
    vi.mocked(getTvShowById).mockResolvedValue({
      data: mockTvShow,
      error: apiError,
    })

    const result = await tryToRecognizeMediaFolderByTmdbIdInFolderName(folderPath)

    expect(result.success).toBe(false)
    expect(consoleErrorSpy).toHaveBeenCalledWith('[preprocessMediaFolder] failed to get TV show by ID:', apiError)
  })

  it('should return failure result when getTvShowById returns undefined data', async () => {
    const folderPath = '/media/tvshows/Test Show (12345)'
    
    vi.mocked(basename).mockReturnValue('Test Show (12345)')
    vi.mocked(getTmdbIdFromFolderName).mockReturnValue('12345')
    vi.mocked(getTvShowById).mockResolvedValue({
      data: undefined,
      error: undefined,
    })

    const result = await tryToRecognizeMediaFolderByTmdbIdInFolderName(folderPath)

    expect(result.success).toBe(false)
    expect(consoleErrorSpy).toHaveBeenCalledWith('[preprocessMediaFolder] failed to get TV show by ID:', { data: undefined, error: undefined })
  })

  it('should parse valid numeric string correctly', async () => {
    const folderPath = '/media/tvshows/Test Show (999999)'
    
    vi.mocked(basename).mockReturnValue('Test Show (999999)')
    vi.mocked(getTmdbIdFromFolderName).mockReturnValue('999999')
    vi.mocked(getTvShowById).mockResolvedValue({
      data: { ...mockTvShow, id: 999999 },
      error: undefined,
    })

    const result = await tryToRecognizeMediaFolderByTmdbIdInFolderName(folderPath)

    expect(result.success).toBe(true)
    expect(result.tmdbTvShow?.id).toBe(999999)
    expect(getTvShowById).toHaveBeenCalledWith(999999, 'zh-CN', undefined)
  })
})
