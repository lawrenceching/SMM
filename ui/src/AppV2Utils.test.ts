import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getTmdbIdFromFolderName, doPreprocessMediaFolder } from './AppV2Utils'
import { preprocessMediaFolder } from './lib/preProcessMediaFolder'
import { getTvShowById } from './api/tmdb'
import type { MediaMetadata, TMDBTVShowDetails } from '@core/types'

vi.mock('./lib/preprocess-media-folder')
vi.mock('./api/tmdb')

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

describe('doPreprocessMediaFolder', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  let mockUpdateMediaMetadata: ReturnType<typeof vi.fn>

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockUpdateMediaMetadata = vi.fn()
    vi.clearAllMocks()
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  const createMockSelectedMediaMetadata = (overrides?: Partial<MediaMetadata>): MediaMetadata => ({
    mediaFolderPath: '/media/tvshow',
    files: [],
    mediaFiles: [],
    ...overrides,
  } as MediaMetadata)

  const createMockTmdbTvShow = (id: number = 1396): TMDBTVShowDetails => ({
    id,
    name: 'Breaking Bad',
    original_name: 'Breaking Bad',
    overview: 'A high school chemistry teacher turned methamphetamine manufacturer',
    poster_path: '/poster.jpg',
    backdrop_path: '/backdrop.jpg',
    first_air_date: '2008-01-20',
    vote_average: 9.5,
    vote_count: 15000,
    popularity: 500,
    genre_ids: [18, 80],
    origin_country: ['US'],
    media_type: 'tv',
    number_of_seasons: 5,
    number_of_episodes: 62,
    seasons: [],
    status: 'Ended',
    type: 'Scripted',
    in_production: false,
    last_air_date: '2013-09-29',
    networks: [],
    production_companies: [],
  })

  it('should successfully preprocess TV show folder and update media metadata', async () => {
    const filePath = '/media/tvshow'
    const traceId = 'test-trace-id'
    const selectedMediaMetadata = createMockSelectedMediaMetadata()
    const mockTmdbTvShow = createMockTmdbTvShow(1396)

    vi.mocked(preprocessMediaFolder).mockResolvedValue({
      success: true,
      type: 'tv',
      tmdbTvShow: { id: 1396 } as any,
    })

    vi.mocked(getTvShowById).mockResolvedValue({
      data: mockTmdbTvShow,
      error: undefined,
    })

    await doPreprocessMediaFolder(filePath, traceId, selectedMediaMetadata, mockUpdateMediaMetadata)

    expect(preprocessMediaFolder).toHaveBeenCalledWith(filePath)
    expect(getTvShowById).toHaveBeenCalledWith(1396, 'zh-CN')
    expect(mockUpdateMediaMetadata).toHaveBeenCalledWith(
      filePath,
      expect.objectContaining({
        ...selectedMediaMetadata,
        tmdbTvShow: mockTmdbTvShow,
        type: 'tvshow-folder',
      }),
      { traceId }
    )
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it('should successfully preprocess movie folder and update media metadata', async () => {
    const filePath = '/media/movie'
    const traceId = 'test-trace-id'
    const selectedMediaMetadata = createMockSelectedMediaMetadata()
    const mockTmdbMovie = {
      id: 27205,
      title: 'Inception',
      overview: 'A thief who steals corporate secrets...',
    }

    vi.mocked(preprocessMediaFolder).mockResolvedValue({
      success: true,
      type: 'movie',
      tmdbMovie: mockTmdbMovie as any,
    })

    await doPreprocessMediaFolder(filePath, traceId, selectedMediaMetadata, mockUpdateMediaMetadata)

    expect(preprocessMediaFolder).toHaveBeenCalledWith(filePath)
    expect(getTvShowById).not.toHaveBeenCalled()
    expect(mockUpdateMediaMetadata).toHaveBeenCalledWith(
      filePath,
      expect.objectContaining({
        ...selectedMediaMetadata,
        tmdbMovie: mockTmdbMovie as any,
        type: 'movie-folder',
      }),
      { traceId }
    )
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it('should log error when preprocessing fails', async () => {
    const filePath = '/media/folder'
    const traceId = 'test-trace-id'
    const selectedMediaMetadata = createMockSelectedMediaMetadata()

    vi.mocked(preprocessMediaFolder).mockResolvedValue({
      success: false,
      type: null,
      tmdbTvShow: undefined,
      tmdbMovie: undefined,
    })

    await doPreprocessMediaFolder(filePath, traceId, selectedMediaMetadata, mockUpdateMediaMetadata)

    expect(preprocessMediaFolder).toHaveBeenCalledWith(filePath)
    expect(getTvShowById).not.toHaveBeenCalled()
    expect(mockUpdateMediaMetadata).not.toHaveBeenCalled()
    expect(consoleLogSpy).toHaveBeenCalledWith(`[AppV2Utils] failed to recognize media folder: ${filePath}`)
  })

  it('should log error when TV show result has undefined tmdbTvShow.id', async () => {
    const filePath = '/media/tvshow'
    const traceId = 'test-trace-id'
    const selectedMediaMetadata = createMockSelectedMediaMetadata()

    vi.mocked(preprocessMediaFolder).mockResolvedValue({
      success: true,
      type: 'tv',
      tmdbTvShow: { id: undefined } as any,
    })

    await doPreprocessMediaFolder(filePath, traceId, selectedMediaMetadata, mockUpdateMediaMetadata)

    expect(preprocessMediaFolder).toHaveBeenCalledWith(filePath)
    expect(getTvShowById).not.toHaveBeenCalled()
    expect(mockUpdateMediaMetadata).not.toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[AppV2Utils] successful recognition result, but the tmdbTvShow.id is undefined'
    )
  })

  it('should log error when getTvShowById returns error', async () => {
    const filePath = '/media/tvshow'
    const traceId = 'test-trace-id'
    const selectedMediaMetadata = createMockSelectedMediaMetadata()
    const errorMessage = 'Failed to fetch TV show details'

    vi.mocked(preprocessMediaFolder).mockResolvedValue({
      success: true,
      type: 'tv',
      tmdbTvShow: { id: 1396 } as any,
    })

    vi.mocked(getTvShowById).mockResolvedValue({
      data: undefined,
      error: errorMessage,
    })

    await doPreprocessMediaFolder(filePath, traceId, selectedMediaMetadata, mockUpdateMediaMetadata)

    expect(preprocessMediaFolder).toHaveBeenCalledWith(filePath)
    expect(getTvShowById).toHaveBeenCalledWith(1396, 'zh-CN')
    expect(mockUpdateMediaMetadata).not.toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `[${traceId}] failed to get TMDB TV show details by TMDB ID from recognition result: ${errorMessage}`
    )
  })

  it('should log error when getTvShowById returns undefined data', async () => {
    const filePath = '/media/tvshow'
    const traceId = 'test-trace-id'
    const selectedMediaMetadata = createMockSelectedMediaMetadata()

    vi.mocked(preprocessMediaFolder).mockResolvedValue({
      success: true,
      type: 'tv',
      tmdbTvShow: { id: 1396 } as any,
    })

    vi.mocked(getTvShowById).mockResolvedValue({
      data: undefined,
      error: undefined,
    })

    await doPreprocessMediaFolder(filePath, traceId, selectedMediaMetadata, mockUpdateMediaMetadata)

    expect(preprocessMediaFolder).toHaveBeenCalledWith(filePath)
    expect(getTvShowById).toHaveBeenCalledWith(1396, 'zh-CN')
    expect(mockUpdateMediaMetadata).not.toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `[${traceId}] failed to get TMDB TV show details by TMDB ID from recognition result: response.data is undefined`
    )
  })

  it('should log error when recognition result type is null', async () => {
    const filePath = '/media/folder'
    const traceId = 'test-trace-id'
    const selectedMediaMetadata = createMockSelectedMediaMetadata()

    vi.mocked(preprocessMediaFolder).mockResolvedValue({
      success: true,
      type: null,
      tmdbTvShow: undefined,
      tmdbMovie: undefined,
    })

    await doPreprocessMediaFolder(filePath, traceId, selectedMediaMetadata, mockUpdateMediaMetadata)

    expect(preprocessMediaFolder).toHaveBeenCalledWith(filePath)
    expect(getTvShowById).not.toHaveBeenCalled()
    expect(mockUpdateMediaMetadata).not.toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[AppV2Utils] successful recognition result, but the type is null'
    )
  })

  it('should handle empty selectedMediaMetadata correctly', async () => {
    const filePath = '/media/tvshow'
    const traceId = 'test-trace-id'
    const selectedMediaMetadata = undefined
    const mockTmdbTvShow = createMockTmdbTvShow(1396)

    vi.mocked(preprocessMediaFolder).mockResolvedValue({
      success: true,
      type: 'tv',
      tmdbTvShow: { id: 1396 } as any,
    })

    vi.mocked(getTvShowById).mockResolvedValue({
      data: mockTmdbTvShow,
      error: undefined,
    })

    await doPreprocessMediaFolder(filePath, traceId, selectedMediaMetadata, mockUpdateMediaMetadata)

    expect(mockUpdateMediaMetadata).toHaveBeenCalledWith(
      filePath,
      expect.objectContaining({
        tmdbTvShow: mockTmdbTvShow,
        type: 'tvshow-folder',
      }),
      { traceId }
    )
  })

  it('should pass correct traceId to updateMediaMetadata for TV shows', async () => {
    const filePath = '/media/tvshow'
    const traceId = 'custom-trace-id-123'
    const selectedMediaMetadata = createMockSelectedMediaMetadata()
    const mockTmdbTvShow = createMockTmdbTvShow(1396)

    vi.mocked(preprocessMediaFolder).mockResolvedValue({
      success: true,
      type: 'tv',
      tmdbTvShow: { id: 1396 } as any,
    })

    vi.mocked(getTvShowById).mockResolvedValue({
      data: mockTmdbTvShow,
      error: undefined,
    })

    await doPreprocessMediaFolder(filePath, traceId, selectedMediaMetadata, mockUpdateMediaMetadata)

    expect(mockUpdateMediaMetadata).toHaveBeenCalledWith(
      filePath,
      expect.any(Object),
      { traceId }
    )
  })

  it('should pass correct traceId to updateMediaMetadata for movies', async () => {
    const filePath = '/media/movie'
    const traceId = 'custom-trace-id-456'
    const selectedMediaMetadata = createMockSelectedMediaMetadata()
    const mockTmdbMovie = {
      id: 27205,
      title: 'Inception',
    }

    vi.mocked(preprocessMediaFolder).mockResolvedValue({
      success: true,
      type: 'movie',
      tmdbMovie: mockTmdbMovie as any,
    })

    await doPreprocessMediaFolder(filePath, traceId, selectedMediaMetadata, mockUpdateMediaMetadata)

    expect(mockUpdateMediaMetadata).toHaveBeenCalledWith(
      filePath,
      expect.any(Object),
      { traceId }
    )
  })

  it('should handle Windows-style paths', async () => {
    const filePath = 'C:\\media\\tvshow'
    const traceId = 'test-trace-id'
    const selectedMediaMetadata = createMockSelectedMediaMetadata()
    const mockTmdbMovie = {
      id: 27205,
      title: 'Inception',
    }

    vi.mocked(preprocessMediaFolder).mockResolvedValue({
      success: true,
      type: 'movie',
      tmdbMovie: mockTmdbMovie as any,
    })

    await doPreprocessMediaFolder(filePath, traceId, selectedMediaMetadata, mockUpdateMediaMetadata)

    expect(mockUpdateMediaMetadata).toHaveBeenCalledWith(
      filePath,
      expect.objectContaining({
        tmdbMovie: mockTmdbMovie as any,
        type: 'movie-folder',
      }),
      { traceId }
    )
  })

  it('should merge selectedMediaMetadata properties correctly', async () => {
    const filePath = '/media/tvshow'
    const traceId = 'test-trace-id'
    const selectedMediaMetadata = createMockSelectedMediaMetadata({
      mediaFolderPath: '/media/tvshow',
      files: ['/media/tvshow/video.mkv'],
      type: 'tvshow-folder',
      tmdbTvShow: createMockTmdbTvShow(999), // Old TV show data
    })
    const mockTmdbTvShow = createMockTmdbTvShow(1396)

    vi.mocked(preprocessMediaFolder).mockResolvedValue({
      success: true,
      type: 'tv',
      tmdbTvShow: { id: 1396 } as any,
    })

    vi.mocked(getTvShowById).mockResolvedValue({
      data: mockTmdbTvShow,
      error: undefined,
    })

    await doPreprocessMediaFolder(filePath, traceId, selectedMediaMetadata, mockUpdateMediaMetadata)

    expect(mockUpdateMediaMetadata).toHaveBeenCalledWith(
      filePath,
      expect.objectContaining({
        mediaFolderPath: '/media/tvshow',
        files: ['/media/tvshow/video.mkv'],
        tmdbTvShow: mockTmdbTvShow, // Updated
        type: 'tvshow-folder',
      }),
      { traceId }
    )
  })
})
