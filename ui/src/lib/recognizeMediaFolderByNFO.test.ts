import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { tryToRecognizeMediaFolderByNFO } from './recognizeMediaFolderByNFO'
import type { UIMediaMetadata } from '@/types/UIMediaMetadata'

// Mock the dependencies
vi.mock('@/api/listFiles', () => ({
  listFiles: vi.fn(),
}))

vi.mock('@/components/TvShowPanelUtils', () => ({
  tryToRecognizeMediaFolderByNFO: vi.fn(),
}))

vi.mock('@core/path', () => ({
  Path: {
    posix: vi.fn(),
  },
}))

import { listFiles } from '@/api/listFiles'
import { tryToRecognizeMediaFolderByNFO as doTryToRecognizeMediaFolderByNFO } from '@/components/TvShowPanelUtils'
import { Path } from '@core/path'

describe('tryToRecognizeMediaFolderByNFO', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(Path.posix).mockImplementation((path) => path)
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  const mockTvShow = {
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
    number_of_seasons: 2,
    number_of_episodes: 20,
    seasons: [],
    status: 'Returning Series',
    type: 'Scripted',
    in_production: true,
    last_air_date: '2024-01-01',
    networks: [],
    production_companies: [],
  }

  const mockFiles = [
    '/media/tvshows/Test Show/Season 1/S01E01.mp4',
    '/media/tvshows/Test Show/Season 1/S01E02.mp4',
    '/media/tvshows/Test Show/tvshow.nfo',
    '/media/tvshows/Test Show/Season 1/S01E03.mp4',
  ]

  it('should return success result when NFO recognition succeeds for TV show', async () => {
    const folderPath = '/media/tvshows/Test Show'
    
    vi.mocked(listFiles).mockResolvedValue({
      data: {
        path: folderPath,
        items: mockFiles.map(path => ({
          path,
          size: 0,
          mtime: 0,
          isDirectory: false,
        })),
        size: mockFiles.length,
      },
      error: undefined,
    })

    const recognizedMetadata: UIMediaMetadata = {
      mediaFolderPath: folderPath,
      files: mockFiles,
      type: 'tvshow-folder',
      tmdbTvShow: mockTvShow,
      tmdbMediaType: 'tv',
      status: 'ok',
    }
    vi.mocked(doTryToRecognizeMediaFolderByNFO).mockResolvedValue(recognizedMetadata)

    const result = await tryToRecognizeMediaFolderByNFO(folderPath)

    expect(result.success).toBe(true)
    expect(result.type).toBe('tvshow-folder')
    expect(result.tmdbTvShow).toEqual(mockTvShow)
    expect(result.tmdbMovie).toBeUndefined()
    expect(listFiles).toHaveBeenCalledWith({
      path: folderPath,
      onlyFiles: true,
      recursively: true,
    })
    expect(doTryToRecognizeMediaFolderByNFO).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaFolderPath: folderPath,
        files: mockFiles,
      }),
      undefined
    )
  })

  it('should return success result when NFO recognition succeeds for movie', async () => {
    const folderPath = '/media/movies/Test Movie'
    const mockMovieFiles = [
      '/media/movies/Test Movie/Test Movie.mkv',
      '/media/movies/Test Movie/movie.nfo',
      '/media/movies/Test Movie/poster.jpg',
    ]
    
    vi.mocked(listFiles).mockResolvedValue({
      data: {
        path: folderPath,
        items: mockMovieFiles.map(path => ({
          path,
          size: 0,
          mtime: 0,
          isDirectory: false,
        })),
        size: mockMovieFiles.length,
      },
      error: undefined,
    })

    const recognizedMetadata: UIMediaMetadata = {
      mediaFolderPath: folderPath,
      files: mockMovieFiles,
      type: 'movie-folder',
      tmdbMovie: {
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
      },
      tmdbMediaType: 'movie',
      status: 'ok',
    }
    vi.mocked(doTryToRecognizeMediaFolderByNFO).mockResolvedValue(recognizedMetadata)

    const result = await tryToRecognizeMediaFolderByNFO(folderPath)

    expect(result.success).toBe(true)
    expect(result.type).toBe('movie-folder')
    expect(result.tmdbMovie).toBeDefined()
    expect(result.tmdbTvShow).toBeUndefined()
    expect(result.tmdbMovie?.id).toBe(67890)
  })

  it('should pass abort signal to NFO recognition', async () => {
    const folderPath = '/media/tvshows/Test Show'
    const abortController = new AbortController()
    const signal = abortController.signal
    
    vi.mocked(listFiles).mockResolvedValue({
      data: {
        path: folderPath,
        items: mockFiles.map(path => ({
          path,
          size: 0,
          mtime: 0,
          isDirectory: false,
        })),
        size: mockFiles.length,
      },
      error: undefined,
    })

    const recognizedMetadata: UIMediaMetadata = {
      mediaFolderPath: folderPath,
      files: mockFiles,
      type: 'tvshow-folder',
      tmdbTvShow: mockTvShow,
      status: 'ok',
    }
    vi.mocked(doTryToRecognizeMediaFolderByNFO).mockResolvedValue(recognizedMetadata)

    const result = await tryToRecognizeMediaFolderByNFO(folderPath, signal)

    expect(result.success).toBe(true)
    expect(doTryToRecognizeMediaFolderByNFO).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaFolderPath: folderPath,
        files: mockFiles,
      }),
      signal
    )
  })

  it('should return failure result when listFiles returns error', async () => {
    const folderPath = '/media/tvshows/Test Show'
    const apiError = 'API Error: Permission denied'
    
    vi.mocked(listFiles).mockResolvedValue({
      data: undefined,
      error: apiError,
    })

    const result = await tryToRecognizeMediaFolderByNFO(folderPath)

    expect(result.success).toBe(false)
    expect(consoleErrorSpy).toHaveBeenCalledWith('[preprocessMediaFolder] failed to list files:', apiError)
    expect(doTryToRecognizeMediaFolderByNFO).not.toHaveBeenCalled()
  })

  it('should return failure result when listFiles returns undefined data', async () => {
    const folderPath = '/media/tvshows/Test Show'
    
    vi.mocked(listFiles).mockResolvedValue({
      data: undefined,
      error: undefined,
    })

    const result = await tryToRecognizeMediaFolderByNFO(folderPath)

    expect(result.success).toBe(false)
    expect(consoleErrorSpy).toHaveBeenCalledWith('[preprocessMediaFolder] failed to list files:', { data: undefined, error: undefined })
    expect(doTryToRecognizeMediaFolderByNFO).not.toHaveBeenCalled()
  })

  it('should return failure result when NFO recognition returns undefined', async () => {
    const folderPath = '/media/tvshows/Test Show'
    
    vi.mocked(listFiles).mockResolvedValue({
      data: {
        path: folderPath,
        items: mockFiles.map(path => ({
          path,
          size: 0,
          mtime: 0,
          isDirectory: false,
        })),
        size: mockFiles.length,
      },
      error: undefined,
    })

    vi.mocked(doTryToRecognizeMediaFolderByNFO).mockResolvedValue(undefined)

    const result = await tryToRecognizeMediaFolderByNFO(folderPath)

    expect(result.success).toBe(false)
    expect(result.tmdbTvShow).toBeUndefined()
    expect(result.tmdbMovie).toBeUndefined()
  })

  it('should convert file paths to posix format', async () => {
    const folderPath = '/media/tvshows/Test Show'
    const windowsFiles = [
      'C:\\media\\tvshows\\Test Show\\Season 1\\S01E01.mp4',
      'C:\\media\\tvshows\\Test Show\\tvshow.nfo',
    ]
    const posixFiles = [
      '/media/tvshows/Test Show/Season 1/S01E01.mp4',
      '/media/tvshows/Test Show/tvshow.nfo',
    ]
    
    vi.mocked(Path.posix)
      .mockReturnValueOnce(posixFiles[0])
      .mockReturnValueOnce(posixFiles[1])
    
    vi.mocked(listFiles).mockResolvedValue({
      data: {
        path: folderPath,
        items: windowsFiles.map(path => ({
          path,
          size: 0,
          mtime: 0,
          isDirectory: false,
        })),
        size: windowsFiles.length,
      },
      error: undefined,
    })

    const recognizedMetadata: UIMediaMetadata = {
      mediaFolderPath: folderPath,
      files: posixFiles,
      type: 'tvshow-folder',
      tmdbTvShow: mockTvShow,
      status: 'ok',
    }
    vi.mocked(doTryToRecognizeMediaFolderByNFO).mockResolvedValue(recognizedMetadata)

    const result = await tryToRecognizeMediaFolderByNFO(folderPath)

    expect(result.success).toBe(true)
    expect(Path.posix).toHaveBeenCalledTimes(2)
    expect(doTryToRecognizeMediaFolderByNFO).toHaveBeenCalledWith(
      expect.objectContaining({
        files: posixFiles,
      }),
      undefined
    )
  })

  it('should handle empty file list', async () => {
    const folderPath = '/media/tvshows/Test Show'
    
    vi.mocked(listFiles).mockResolvedValue({
      data: {
        path: folderPath,
        items: [],
        size: 0,
      },
      error: undefined,
    })

    const recognizedMetadata: UIMediaMetadata = {
      mediaFolderPath: folderPath,
      files: [],
      type: 'tvshow-folder',
      tmdbTvShow: mockTvShow,
      status: 'ok',
    }
    vi.mocked(doTryToRecognizeMediaFolderByNFO).mockResolvedValue(recognizedMetadata)

    const result = await tryToRecognizeMediaFolderByNFO(folderPath)

    expect(result.success).toBe(true)
    expect(doTryToRecognizeMediaFolderByNFO).toHaveBeenCalledWith(
      expect.objectContaining({
        files: [],
      }),
      undefined
    )
  })
})
