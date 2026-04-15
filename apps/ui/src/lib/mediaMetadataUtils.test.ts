import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createInitialMediaMetadata, findUpdatedMediaMetadata } from './mediaMetadataUtils'

vi.mock('@/api/listFiles', () => ({
  listFiles: vi.fn(),
}))

import { listFiles } from '@/api/listFiles'

describe('createInitialMediaMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return metadata with mediaFolderPath, status, type, and files', async () => {
    const folderPath = '/media/tvshows/Test Show'
    const type = 'tvshow-folder' as const
    const mockFiles = [
      '/media/tvshows/Test Show/episode1.mkv',
      '/media/tvshows/Test Show/episode2.mkv',
    ]

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

    const result = await createInitialMediaMetadata(folderPath, type)

    expect(result.mediaFolderPath).toBeDefined()
    expect(result.mediaFolderPath).toBe(folderPath)
    expect(result.status).toBeDefined()
    expect(result.status).toBe('idle')
    expect(result.type).toBeDefined()
    expect(result.type).toBe(type)
    expect(result.files).toBeDefined()
    expect(result.files).toEqual(mockFiles)
  })

  it('should throw error when listFiles API returns error', async () => {
    const folderPath = '/media/tvshows/Test Show'
    const type = 'tvshow-folder' as const

    vi.mocked(listFiles).mockResolvedValue({
      data: undefined,
      error: 'Permission denied',
    })

    await expect(createInitialMediaMetadata(folderPath, type)).rejects.toThrow('Failed to list files: Permission denied')
  })

  it('should throw error when listFiles API returns undefined data', async () => {
    const folderPath = '/media/tvshows/Test Show'
    const type = 'tvshow-folder' as const

    vi.mocked(listFiles).mockResolvedValue({
      data: undefined,
      error: undefined,
    })

    await expect(createInitialMediaMetadata(folderPath, type)).rejects.toThrow('Failed to list files: response.data is undefined')
  })

  it('should convert Windows local file paths to POSIX format', async () => {
    const folderPath = 'C:\\media\\tvshows\\Test Show'
    const type = 'tvshow-folder' as const
    const mockWindowsFiles = [
      'C:\\media\\tvshows\\Test Show\\episode1.mkv',
      'C:\\media\\tvshows\\Test Show\\episode2.mkv',
    ]
    const expectedPosixFiles = [
      '/C/media/tvshows/Test Show/episode1.mkv',
      '/C/media/tvshows/Test Show/episode2.mkv',
    ]

    vi.mocked(listFiles).mockResolvedValue({
      data: {
        path: folderPath,
        items: mockWindowsFiles.map(path => ({
          path,
          size: 0,
          mtime: 0,
          isDirectory: false,
        })),
        size: mockWindowsFiles.length,
      },
      error: undefined,
    })

    const result = await createInitialMediaMetadata(folderPath, type)

    expect(result.mediaFolderPath).toBeDefined()
    expect(result.mediaFolderPath).toBe('/C/media/tvshows/Test Show')
    expect(result.status).toBeDefined()
    expect(result.status).toBe('idle')
    expect(result.type).toBeDefined()
    expect(result.type).toBe(type)
    expect(result.files).toBeDefined()
    expect(result.files).toEqual(expectedPosixFiles)
  })

  it('should convert Windows network paths to POSIX format', async () => {
    const folderPath = '\\\\nas.local\\share\\media\\tvshows\\Test Show'
    const type = 'tvshow-folder' as const
    const mockNetworkFiles = [
      '\\\\nas.local\\share\\media\\tvshows\\Test Show\\episode1.mkv',
      '\\\\nas.local\\share\\media\\tvshows\\Test Show\\episode2.mkv',
    ]
    const expectedPosixFiles = [
      '/nas.local/share/media/tvshows/Test Show/episode1.mkv',
      '/nas.local/share/media/tvshows/Test Show/episode2.mkv',
    ]

    vi.mocked(listFiles).mockResolvedValue({
      data: {
        path: folderPath,
        items: mockNetworkFiles.map(path => ({
          path,
          size: 0,
          mtime: 0,
          isDirectory: false,
        })),
        size: mockNetworkFiles.length,
      },
      error: undefined,
    })

    const result = await createInitialMediaMetadata(folderPath, type)

    expect(result.mediaFolderPath).toBeDefined()
    expect(result.mediaFolderPath).toBe('/nas.local/share/media/tvshows/Test Show')
    expect(result.status).toBeDefined()
    expect(result.status).toBe('idle')
    expect(result.type).toBeDefined()
    expect(result.type).toBe(type)
    expect(result.files).toBeDefined()
    expect(result.files).toEqual(expectedPosixFiles)
  })

  it('should pass abortSignal to listFiles', async () => {
    const folderPath = '/media/tvshows/Test Show'
    const type = 'tvshow-folder' as const
    const mockFiles = [
      '/media/tvshows/Test Show/episode1.mkv',
    ]
    const abortSignal = new AbortController().signal

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

    await createInitialMediaMetadata(folderPath, type, { abortSignal })

    expect(listFiles).toHaveBeenCalledWith(
      { path: folderPath, recursively: true, onlyFiles: true },
      abortSignal
    )
  })

  it('should merge mediaMetadataProps into result', async () => {
    const folderPath = '/media/tvshows/Test Show'
    const type = 'tvshow-folder' as const
    const mockFiles = [
      '/media/tvshows/Test Show/episode1.mkv',
    ]
    const mediaMetadataProps = {
      tvShow: {
        id: '12345',
        name: 'Custom Name',
        database: 'TMDB' as const,
        seasons: [],
      },
    }

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

    const result = await createInitialMediaMetadata(folderPath, type, { mediaMetadataProps })

    expect(result.tvShow?.name).toBe('Custom Name')
    expect(result.tvShow?.id).toBe('12345')
    expect(result.mediaFolderPath).toBe(folderPath)
    expect(result.type).toBe(type)
  })

  it('should work with music-folder type', async () => {
    const folderPath = '/media/music/Album'
    const type = 'music-folder' as const
    const mockFiles = [
      '/media/music/Album/song1.mp3',
      '/media/music/Album/song2.mp3',
    ]

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

    const result = await createInitialMediaMetadata(folderPath, type)

    expect(result.type).toBe(type)
    expect(result.mediaFolderPath).toBe(folderPath)
    expect(result.status).toBe('idle')
  })

  it('should work with movie-folder type', async () => {
    const folderPath = '/media/movies/Movie'
    const type = 'movie-folder' as const
    const mockFiles = [
      '/media/movies/Movie/movie.mkv',
    ]

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

    const result = await createInitialMediaMetadata(folderPath, type)

    expect(result.type).toBe(type)
    expect(result.mediaFolderPath).toBe(folderPath)
    expect(result.status).toBe('idle')
  })
})

describe('findUpdatedMediaMetadata', () => {
  it('should return empty array when both arrays are empty', () => {
    const result = findUpdatedMediaMetadata([], [])
    expect(result).toEqual([])
  })

  it('should return empty array when old array is empty and new array is empty', () => {
    const result = findUpdatedMediaMetadata([], [])
    expect(result).toEqual([])
  })

  it('should return all new items when old array is empty', () => {
    const newItems = [
      { mediaFolderPath: '/media/show1', type: 'tvshow-folder' as const },
      { mediaFolderPath: '/media/show2', type: 'tvshow-folder' as const },
    ]

    const result = findUpdatedMediaMetadata([], newItems)

    expect(result).toEqual(newItems)
  })

  it('should return empty array when new array is empty', () => {
    const oldItems = [
      { mediaFolderPath: '/media/show1', type: 'tvshow-folder' as const },
      { mediaFolderPath: '/media/show2', type: 'tvshow-folder' as const },
    ]

    const result = findUpdatedMediaMetadata(oldItems, [])

    expect(result).toEqual([])
  })

  it('should return empty array when all items are identical', () => {
    const oldItems = [
      {
        mediaFolderPath: '/media/show1',
        type: 'tvshow-folder' as const,
        tvShow: { id: '1', name: 'Show 1', database: 'TMDB' as const, seasons: [] },
      },
      {
        mediaFolderPath: '/media/show2',
        type: 'tvshow-folder' as const,
        tvShow: { id: '2', name: 'Show 2', database: 'TMDB' as const, seasons: [] },
      },
    ]

    const newItems = [
      {
        mediaFolderPath: '/media/show1',
        type: 'tvshow-folder' as const,
        tvShow: { id: '1', name: 'Show 1', database: 'TMDB' as const, seasons: [] },
      },
      {
        mediaFolderPath: '/media/show2',
        type: 'tvshow-folder' as const,
        tvShow: { id: '2', name: 'Show 2', database: 'TMDB' as const, seasons: [] },
      },
    ]

    const result = findUpdatedMediaMetadata(oldItems, newItems)

    expect(result).toEqual([])
  })

  it('should detect changed tvShow name', () => {
    const oldItems = [
      {
        mediaFolderPath: '/media/show1',
        type: 'tvshow-folder' as const,
        tvShow: { id: '1', name: 'Old Name', database: 'TMDB' as const, seasons: [] },
      },
    ]

    const newItems = [
      {
        mediaFolderPath: '/media/show1',
        type: 'tvshow-folder' as const,
        tvShow: { id: '1', name: 'New Name', database: 'TMDB' as const, seasons: [] },
      },
    ]

    const result = findUpdatedMediaMetadata(oldItems, newItems)

    expect(result).toEqual(newItems)
  })

  it('should detect changed tvShow seasons', () => {
    const oldItems = [
      {
        mediaFolderPath: '/media/show1',
        type: 'tvshow-folder' as const,
        tvShow: { id: '1', name: 'Show 1', database: 'TMDB' as const, seasons: [] },
      },
    ]

    const newItems = [
      {
        mediaFolderPath: '/media/show1',
        type: 'tvshow-folder' as const,
        tvShow: {
          id: '1',
          name: 'Show 1',
          database: 'TMDB' as const,
          seasons: [{ season: 1, name: 'Season 1', episodes: [] }],
        },
      },
    ]

    const result = findUpdatedMediaMetadata(oldItems, newItems)

    expect(result).toEqual(newItems)
  })

  it('should detect changed movie metadata', () => {
    const oldItems = [
      {
        mediaFolderPath: '/media/movie1',
        type: 'movie-folder' as const,
        movie: { id: '1', name: 'Movie 1', database: 'TMDB' as const },
      },
    ]

    const newItems = [
      {
        mediaFolderPath: '/media/movie1',
        type: 'movie-folder' as const,
        movie: { id: '1', name: 'Movie 1 Updated', database: 'TMDB' as const },
      },
    ]

    const result = findUpdatedMediaMetadata(oldItems, newItems)

    expect(result).toEqual(newItems)
  })

  it('should detect changed mediaFiles', () => {
    const oldItems = [
      {
        mediaFolderPath: '/media/show1',
        type: 'tvshow-folder' as const,
        mediaFiles: [{ absolutePath: '/media/show1/episode1.mkv', seasonNumber: 1, episodeNumber: 1 }],
      },
    ]

    const newItems = [
      {
        mediaFolderPath: '/media/show1',
        type: 'tvshow-folder' as const,
        mediaFiles: [
          { absolutePath: '/media/show1/episode1.mkv', seasonNumber: 1, episodeNumber: 1 },
          { absolutePath: '/media/show1/episode2.mkv', seasonNumber: 1, episodeNumber: 2 },
        ],
      },
    ]

    const result = findUpdatedMediaMetadata(oldItems, newItems)

    expect(result).toEqual(newItems)
  })

  it('should detect changed files list', () => {
    const oldItems = [
      {
        mediaFolderPath: '/media/show1',
        type: 'tvshow-folder' as const,
        files: ['/media/show1/a.mkv'],
      },
    ]

    const newItems = [
      {
        mediaFolderPath: '/media/show1',
        type: 'tvshow-folder' as const,
        files: ['/media/show1/b.mkv'],
      },
    ]

    const result = findUpdatedMediaMetadata(oldItems, newItems)

    expect(result).toEqual(newItems)
  })

  it('should detect changed type', () => {
    const oldItems = [
      {
        mediaFolderPath: '/media/show1',
        type: 'tvshow-folder' as const,
      },
    ]

    const newItems = [
      {
        mediaFolderPath: '/media/show1',
        type: 'movie-folder' as const,
      },
    ]

    const result = findUpdatedMediaMetadata(oldItems, newItems)

    expect(result).toEqual(newItems)
  })

  it('should return new items that are not in old array', () => {
    const oldItems = [
      { mediaFolderPath: '/media/show1', type: 'tvshow-folder' as const },
    ]

    const newItems = [
      { mediaFolderPath: '/media/show1', type: 'tvshow-folder' as const },
      { mediaFolderPath: '/media/show2', type: 'tvshow-folder' as const },
    ]

    const result = findUpdatedMediaMetadata(oldItems, newItems)

    expect(result).toEqual([
      { mediaFolderPath: '/media/show2', type: 'tvshow-folder' as const },
    ])
  })

  it('should handle items with no mediaFolderPath in old array', () => {
    const oldItems = [
      { type: 'tvshow-folder' as const },
    ]

    const newItems = [
      { mediaFolderPath: '/media/show1', type: 'tvshow-folder' as const },
    ]

    const result = findUpdatedMediaMetadata(oldItems, newItems)

    expect(result).toEqual(newItems)
  })

  it('should skip items with no mediaFolderPath in new array', () => {
    const oldItems = [
      { mediaFolderPath: '/media/show1', type: 'tvshow-folder' as const },
    ]

    const newItems = [
      { type: 'tvshow-folder' as const },
    ]

    const result = findUpdatedMediaMetadata(oldItems, newItems)

    expect(result).toEqual([])
  })

  it('should return multiple changed items', () => {
    const oldItems = [
      {
        mediaFolderPath: '/media/show1',
        type: 'tvshow-folder' as const,
        tvShow: { id: '1', name: 'Show 1', database: 'TMDB' as const, seasons: [] },
      },
      {
        mediaFolderPath: '/media/show2',
        type: 'tvshow-folder' as const,
        tvShow: { id: '2', name: 'Show 2', database: 'TMDB' as const, seasons: [] },
      },
      {
        mediaFolderPath: '/media/show3',
        type: 'tvshow-folder' as const,
        tvShow: { id: '3', name: 'Show 3', database: 'TMDB' as const, seasons: [] },
      },
    ]

    const newItems = [
      {
        mediaFolderPath: '/media/show1',
        type: 'tvshow-folder' as const,
        tvShow: { id: '1', name: 'Show 1', database: 'TMDB' as const, seasons: [] },
      },
      {
        mediaFolderPath: '/media/show2',
        type: 'tvshow-folder' as const,
        tvShow: { id: '2', name: 'Changed Show 2', database: 'TMDB' as const, seasons: [] },
      },
      {
        mediaFolderPath: '/media/show3',
        type: 'tvshow-folder' as const,
        tvShow: { id: '3', name: 'Changed Show 3', database: 'TMDB' as const, seasons: [] },
      },
    ]

    const result = findUpdatedMediaMetadata(oldItems, newItems)

    expect(result).toEqual([
      {
        mediaFolderPath: '/media/show2',
        type: 'tvshow-folder' as const,
        tvShow: { id: '2', name: 'Changed Show 2', database: 'TMDB' as const, seasons: [] },
      },
      {
        mediaFolderPath: '/media/show3',
        type: 'tvshow-folder' as const,
        tvShow: { id: '3', name: 'Changed Show 3', database: 'TMDB' as const, seasons: [] },
      },
    ])
  })

  it('should detect changes when tvShow changes from undefined to object', () => {
    const oldItems = [
      {
        mediaFolderPath: '/media/show1',
        type: 'tvshow-folder' as const,
      },
    ]

    const newItems = [
      {
        mediaFolderPath: '/media/show1',
        type: 'tvshow-folder' as const,
        tvShow: { id: '1', name: 'Show 1', database: 'TMDB' as const, seasons: [] },
      },
    ]

    const result = findUpdatedMediaMetadata(oldItems, newItems)

    expect(result).toEqual(newItems)
  })

  it('should detect changes when movie changes from undefined to object', () => {
    const oldItems = [
      {
        mediaFolderPath: '/media/movie1',
        type: 'movie-folder' as const,
      },
    ]

    const newItems = [
      {
        mediaFolderPath: '/media/movie1',
        type: 'movie-folder' as const,
        movie: { id: '1', name: 'Movie 1', database: 'TMDB' as const },
      },
    ]

    const result = findUpdatedMediaMetadata(oldItems, newItems)

    expect(result).toEqual(newItems)
  })

  it('should detect changes when mediaFiles changes from undefined to array', () => {
    const oldItems = [
      {
        mediaFolderPath: '/media/show1',
        type: 'tvshow-folder' as const,
        mediaFiles: undefined,
      },
    ]

    const newItems = [
      {
        mediaFolderPath: '/media/show1',
        type: 'tvshow-folder' as const,
        mediaFiles: [{ absolutePath: '/media/show1/episode1.mkv', seasonNumber: 1, episodeNumber: 1 }],
      },
    ]

    const result = findUpdatedMediaMetadata(oldItems, newItems)

    expect(result).toEqual(newItems)
  })

  it('should handle mixed scenarios with some items changed and some unchanged', () => {
    const oldItems = [
      {
        mediaFolderPath: '/media/show1',
        type: 'tvshow-folder' as const,
        tvShow: { id: '1', name: 'Show 1', database: 'TMDB' as const, seasons: [] },
      },
      {
        mediaFolderPath: '/media/show2',
        type: 'tvshow-folder' as const,
        tvShow: { id: '2', name: 'Show 2', database: 'TMDB' as const, seasons: [] },
      },
      {
        mediaFolderPath: '/media/show3',
        type: 'tvshow-folder' as const,
        tvShow: { id: '3', name: 'Show 3', database: 'TMDB' as const, seasons: [] },
      },
      {
        mediaFolderPath: '/media/show4',
        type: 'tvshow-folder' as const,
        tvShow: { id: '4', name: 'Show 4', database: 'TMDB' as const, seasons: [] },
      },
    ]

    const newItems = [
      {
        mediaFolderPath: '/media/show1',
        type: 'tvshow-folder' as const,
        tvShow: { id: '1', name: 'Show 1', database: 'TMDB' as const, seasons: [] },
      },
      {
        mediaFolderPath: '/media/show2',
        type: 'tvshow-folder' as const,
        tvShow: { id: '2', name: 'Changed Show 2', database: 'TMDB' as const, seasons: [] },
      },
      {
        mediaFolderPath: '/media/show3',
        type: 'tvshow-folder' as const,
        tvShow: { id: '3', name: 'Show 3', database: 'TMDB' as const, seasons: [] },
      },
      {
        mediaFolderPath: '/media/show5',
        type: 'tvshow-folder' as const,
        tvShow: { id: '5', name: 'Show 5', database: 'TMDB' as const, seasons: [] },
      },
    ]

    const result = findUpdatedMediaMetadata(oldItems, newItems)

    expect(result).toEqual([
      {
        mediaFolderPath: '/media/show2',
        type: 'tvshow-folder' as const,
        tvShow: { id: '2', name: 'Changed Show 2', database: 'TMDB' as const, seasons: [] },
      },
      {
        mediaFolderPath: '/media/show5',
        type: 'tvshow-folder' as const,
        tvShow: { id: '5', name: 'Show 5', database: 'TMDB' as const, seasons: [] },
      },
    ])
  })
})
