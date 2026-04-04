import { describe, it, expect } from 'vitest'
import type { UIMediaMetadata } from '@/types/UIMediaMetadata'
import { minimize } from './log'

describe('minimize', () => {
  const mockTvShowMetadata: UIMediaMetadata = {
    status: 'ok',
    mediaFolderPath: '/media/tvshows/Test Show',
    type: 'tvshow-folder',
    tvShow: {
      id: '12345',
      name: 'Test TV Show',
      database: 'TMDB',
      seasons: [],
    },
    files: ['file1.mkv', 'file2.mkv', 'file3.mkv'],
  }

  const mockMovieMetadata: UIMediaMetadata = {
    status: 'ok',
    mediaFolderPath: '/media/movies/Test Movie',
    type: 'movie-folder',
    movie: {
      id: '67890',
      name: 'Test Movie',
      database: 'TMDB',
    },
    files: ['movie.mkv'],
  }

  it('should minimize TV show metadata with files', () => {
    const result = minimize(mockTvShowMetadata)

    expect(result.mediaFolderPath).toBe('/media/tvshows/Test Show')
    expect(result.type).toBe('tvshow-folder')
    expect(result.name).toBe('Test TV Show')
    expect(result.files).toBe('3 files')
    expect(result.tvShow).toEqual({
      id: '12345',
      name: 'Test TV Show',
    })
    expect(result.movie).toEqual({
      id: undefined,
      name: undefined,
    })
  })

  it('should minimize movie metadata with files', () => {
    const result = minimize(mockMovieMetadata)

    expect(result.mediaFolderPath).toBe('/media/movies/Test Movie')
    expect(result.type).toBe('movie-folder')
    expect(result.name).toBeUndefined()
    expect(result.files).toBe('1 files')
    expect(result.tvShow).toEqual({
      id: undefined,
      name: undefined,
    })
    expect(result.movie).toEqual({
      id: '67890',
      name: 'Test Movie',
    })
  })

  it('should handle metadata with undefined files', () => {
    const metadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/tvshows/Test Show',
      type: 'tvshow-folder',
      tvShow: {
        id: '12345',
        name: 'Test TV Show',
        database: 'TMDB',
        seasons: [],
      },
      files: undefined,
    }

    const result = minimize(metadata)

    expect(result.files).toBe('undefined')
    expect(result.tvShow).toEqual({
      id: '12345',
      name: 'Test TV Show',
    })
  })

  it('should handle metadata with null files', () => {
    const metadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/movies/Test Movie',
      type: 'movie-folder',
      movie: {
        id: '67890',
        name: 'Test Movie',
        database: 'TMDB',
      },
      files: null,
    }

    const result = minimize(metadata)

    expect(result.files).toBe('null')
    expect(result.movie).toEqual({
      id: '67890',
      name: 'Test Movie',
    })
  })

  it('should handle empty files array', () => {
    const metadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/tvshows/Empty Show',
      type: 'tvshow-folder',
      tvShow: {
        id: '11111',
        name: 'Empty Show',
        database: 'TMDB',
        seasons: [],
      },
      files: [],
    }

    const result = minimize(metadata)

    expect(result.files).toBe('0 files')
  })

  it('should handle empty metadata', () => {
    const metadata: UIMediaMetadata = { status: 'ok' }

    const result = minimize(metadata)

    expect(result.mediaFolderPath).toBeUndefined()
    expect(result.type).toBeUndefined()
    expect(result.name).toBeUndefined()
    expect(result.files).toBe('undefined')
    expect(result.tvShow).toEqual({
      id: undefined,
      name: undefined,
    })
    expect(result.movie).toEqual({
      id: undefined,
      name: undefined,
    })
  })

  it('should handle metadata with only tvShow', () => {
    const metadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/tvshows/Only Show',
      type: 'tvshow-folder',
      tvShow: {
        id: '22222',
        name: 'Only TV Show',
        database: 'TMDB',
        seasons: [],
      },
    }

    const result = minimize(metadata)

    expect(result.mediaFolderPath).toBe('/media/tvshows/Only Show')
    expect(result.type).toBe('tvshow-folder')
    expect(result.name).toBe('Only TV Show')
    expect(result.files).toBe('undefined')
    expect(result.tvShow).toEqual({
      id: '22222',
      name: 'Only TV Show',
    })
    expect(result.movie).toEqual({
      id: undefined,
      name: undefined,
    })
  })

  it('should handle metadata with only movie', () => {
    const metadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/movies/Only Movie',
      type: 'movie-folder',
      movie: {
        id: '33333',
        name: 'Only Movie',
        database: 'TMDB',
      },
    }

    const result = minimize(metadata)

    expect(result.mediaFolderPath).toBe('/media/movies/Only Movie')
    expect(result.type).toBe('movie-folder')
    expect(result.name).toBeUndefined()
    expect(result.files).toBe('undefined')
    expect(result.tvShow).toEqual({
      id: undefined,
      name: undefined,
    })
    expect(result.movie).toEqual({
      id: '33333',
      name: 'Only Movie',
    })
  })

  it('should handle metadata with neither tvShow nor movie', () => {
    const metadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/unknown',
      type: 'music-folder',
      files: ['song.mp3'],
    }

    const result = minimize(metadata)

    expect(result.mediaFolderPath).toBe('/media/unknown')
    expect(result.type).toBe('music-folder')
    expect(result.name).toBeUndefined()
    expect(result.files).toBe('1 files')
    expect(result.tvShow).toEqual({
      id: undefined,
      name: undefined,
    })
    expect(result.movie).toEqual({
      id: undefined,
      name: undefined,
    })
  })

  it('should handle single file in files array', () => {
    const metadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/movies/Single File',
      type: 'movie-folder',
      files: ['single.mkv'],
    }

    const result = minimize(metadata)

    expect(result.files).toBe('1 files')
  })

  it('should handle many files in files array', () => {
    const metadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/tvshows/Multi File Show',
      type: 'tvshow-folder',
      files: [
        'episode1.mkv',
        'episode2.mkv',
        'episode3.mkv',
        'episode4.mkv',
        'episode5.mkv',
      ],
    }

    const result = minimize(metadata)

    expect(result.files).toBe('5 files')
  })

  it('should correctly extract name from tvShow', () => {
    const metadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/tvshows/Named Show',
      type: 'tvshow-folder',
      tvShow: {
        id: '44444',
        name: 'This Is The Name',
        database: 'TMDB',
        seasons: [],
      },
    }

    const result = minimize(metadata)

    expect(result.name).toBe('This Is The Name')
  })

  it('should minimize TV show metadata with partial tvShow data', () => {
    const metadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/tvshows/Partial Show',
      type: 'tvshow-folder',
      tvShow: {
        id: '55555',
        name: 'Partial TV Show',
        database: 'TMDB',
        seasons: [],
      },
    }

    const result = minimize(metadata)

    expect(result.name).toBe('Partial TV Show')
    expect(result.tvShow).toEqual({
      id: '55555',
      name: 'Partial TV Show',
    })
  })

  it('should minimize movie metadata with partial movie data', () => {
    const metadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/movies/Partial Movie',
      type: 'movie-folder',
      movie: {
        id: '66666',
        name: 'Partial Movie',
        database: 'TMDB',
      },
    }

    const result = minimize(metadata)

    expect(result.movie).toEqual({
      id: '66666',
      name: 'Partial Movie',
    })
  })
})
