import { describe, it, expect } from 'vitest'
import { createInitialMediaMetadata, findUpdatedMediaMetadata } from './mediaMetadataUtils'

describe('createInitialMediaMetadata', () => {
  it('should return persisted metadata shell for a folder', async () => {
    const folderPath = '/media/tvshows/Test Show'
    const type = 'tvshow-folder' as const

    const result = await createInitialMediaMetadata(folderPath, type)

    expect(result.mediaFolderPath).toBe(folderPath)
    expect(result.type).toBe(type)
  })

  it('should convert Windows local folder paths to POSIX format', async () => {
    const folderPath = 'C:\\media\\tvshows\\Test Show'
    const type = 'tvshow-folder' as const

    const result = await createInitialMediaMetadata(folderPath, type)

    expect(result.mediaFolderPath).toBe('/C/media/tvshows/Test Show')
    expect(result.type).toBe(type)
  })

  it('should convert Windows network folder paths to POSIX format', async () => {
    const folderPath = '\\\\nas.local\\share\\media\\tvshows\\Test Show'
    const type = 'tvshow-folder' as const

    const result = await createInitialMediaMetadata(folderPath, type)

    expect(result.mediaFolderPath).toBe('/nas.local/share/media/tvshows/Test Show')
    expect(result.type).toBe(type)
  })

  it('should merge mediaMetadataProps into result', async () => {
    const folderPath = '/media/tvshows/Test Show'
    const type = 'tvshow-folder' as const
    const mediaMetadataProps = {
      tvShow: {
        id: '12345',
        name: 'Custom Name',
        database: 'TMDB' as const,
        seasons: [],
      },
    }

    const result = await createInitialMediaMetadata(folderPath, type, { mediaMetadataProps })

    expect(result.tvShow?.name).toBe('Custom Name')
    expect(result.tvShow?.id).toBe('12345')
    expect(result.mediaFolderPath).toBe(folderPath)
    expect(result.type).toBe(type)
  })

  it('should work with music-folder type', async () => {
    const folderPath = '/media/music/Album'
    const type = 'music-folder' as const

    const result = await createInitialMediaMetadata(folderPath, type)

    expect(result.type).toBe(type)
    expect(result.mediaFolderPath).toBe(folderPath)
  })

  it('should work with movie-folder type', async () => {
    const folderPath = '/media/movies/Movie'
    const type = 'movie-folder' as const

    const result = await createInitialMediaMetadata(folderPath, type)

    expect(result.type).toBe(type)
    expect(result.mediaFolderPath).toBe(folderPath)
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
    ]
    const result = findUpdatedMediaMetadata([], newItems)
    expect(result).toEqual(newItems)
  })

  it('should return empty array when new array is empty', () => {
    const oldItems = [
      { mediaFolderPath: '/media/show1', type: 'tvshow-folder' as const },
    ]
    const result = findUpdatedMediaMetadata(oldItems, [])
    expect(result).toEqual([])
  })

  it('should return empty array when all items are identical', () => {
    const items = [
      { mediaFolderPath: '/media/show1', type: 'tvshow-folder' as const },
    ]
    const result = findUpdatedMediaMetadata(items, items)
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
        tvShow: { id: '1', name: 'Show', database: 'TMDB' as const, seasons: [] },
      },
    ]
    const newItems = [
      {
        mediaFolderPath: '/media/show1',
        type: 'tvshow-folder' as const,
        tvShow: {
          id: '1',
          name: 'Show',
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
        movie: { id: '1', name: 'Old Movie', database: 'TMDB' as const },
      },
    ]
    const newItems = [
      {
        mediaFolderPath: '/media/movie1',
        type: 'movie-folder' as const,
        movie: { id: '1', name: 'New Movie', database: 'TMDB' as const },
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
        mediaFiles: [{ absolutePath: '/media/show1/a.mkv', seasonNumber: 1, episodeNumber: 1 }],
      },
    ]
    const newItems = [
      {
        mediaFolderPath: '/media/show1',
        type: 'tvshow-folder' as const,
        mediaFiles: [{ absolutePath: '/media/show1/b.mkv', seasonNumber: 1, episodeNumber: 1 }],
      },
    ]
    const result = findUpdatedMediaMetadata(oldItems, newItems)
    expect(result).toEqual(newItems)
  })

  it('should detect changed type', () => {
    const oldItems = [
      { mediaFolderPath: '/media/show1', type: 'tvshow-folder' as const },
    ]
    const newItems = [
      { mediaFolderPath: '/media/show1', type: 'movie-folder' as const },
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
    expect(result).toEqual([newItems[1]])
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
      { mediaFolderPath: '/media/show1', type: 'tvshow-folder' as const },
      { mediaFolderPath: '/media/show2', type: 'tvshow-folder' as const },
    ]
    const newItems = [
      { mediaFolderPath: '/media/show1', type: 'movie-folder' as const },
      { mediaFolderPath: '/media/show2', type: 'tvshow-folder' as const },
    ]
    const result = findUpdatedMediaMetadata(oldItems, newItems)
    expect(result).toEqual([newItems[0]])
  })

  it('should detect changes when tvShow changes from undefined to object', () => {
    const oldItems = [
      { mediaFolderPath: '/media/show1', type: 'tvshow-folder' as const },
    ]
    const newItems = [
      {
        mediaFolderPath: '/media/show1',
        type: 'tvshow-folder' as const,
        tvShow: { id: '1', name: 'Show', database: 'TMDB' as const, seasons: [] },
      },
    ]
    const result = findUpdatedMediaMetadata(oldItems, newItems)
    expect(result).toEqual(newItems)
  })

  it('should detect changes when movie changes from undefined to object', () => {
    const oldItems = [
      { mediaFolderPath: '/media/movie1', type: 'movie-folder' as const },
    ]
    const newItems = [
      {
        mediaFolderPath: '/media/movie1',
        type: 'movie-folder' as const,
        movie: { id: '1', name: 'Movie', database: 'TMDB' as const },
      },
    ]
    const result = findUpdatedMediaMetadata(oldItems, newItems)
    expect(result).toEqual(newItems)
  })

  it('should detect changes when mediaFiles changes from undefined to array', () => {
    const oldItems = [
      { mediaFolderPath: '/media/show1', type: 'tvshow-folder' as const },
    ]
    const newItems = [
      {
        mediaFolderPath: '/media/show1',
        type: 'tvshow-folder' as const,
        mediaFiles: [{ absolutePath: '/media/show1/a.mkv', seasonNumber: 1, episodeNumber: 1 }],
      },
    ]
    const result = findUpdatedMediaMetadata(oldItems, newItems)
    expect(result).toEqual(newItems)
  })

  it('should handle mixed scenarios with some items changed and some unchanged', () => {
    const oldItems = [
      { mediaFolderPath: '/media/show1', type: 'tvshow-folder' as const },
      { mediaFolderPath: '/media/show2', type: 'tvshow-folder' as const },
      { mediaFolderPath: '/media/show3', type: 'tvshow-folder' as const },
    ]
    const newItems = [
      { mediaFolderPath: '/media/show1', type: 'tvshow-folder' as const },
      { mediaFolderPath: '/media/show2', type: 'movie-folder' as const },
      { mediaFolderPath: '/media/show4', type: 'tvshow-folder' as const },
    ]
    const result = findUpdatedMediaMetadata(oldItems, newItems)
    expect(result).toEqual([newItems[1], newItems[2]])
  })
})
