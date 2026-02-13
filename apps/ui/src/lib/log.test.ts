import { describe, it, expect } from 'vitest'
import type { UIMediaMetadata } from '@/types/UIMediaMetadata'
import { minimize } from './log'

describe('minimize', () => {
  const mockTvShowMetadata: UIMediaMetadata = {
    status: 'ok',
    mediaFolderPath: '/media/tvshows/Test Show',
    type: 'tvshow-folder',
    tmdbTvShow: {
      id: 12345,
      name: 'Test TV Show',
      overview: 'A test TV show overview',
      first_air_date: '2020-01-01',
      poster_path: '/poster.jpg',
      backdrop_path: '/backdrop.jpg',
      vote_average: 8.5,
      vote_count: 100,
      genre_ids: [1, 2],
      origin_country: ['US'],
      original_name: 'Test TV Show Original',
      popularity: 100.5,
      number_of_seasons: 3,
      number_of_episodes: 30,
      seasons: [],
      status: 'Running',
      type: 'Scripted',
      in_production: true,
      last_air_date: '2022-12-31',
      networks: [],
      production_companies: [],
    },
    files: ['file1.mkv', 'file2.mkv', 'file3.mkv'],
  }

  const mockMovieMetadata: UIMediaMetadata = {
    status: 'ok',
    mediaFolderPath: '/media/movies/Test Movie',
    type: 'movie-folder',
    tmdbMovie: {
      id: 67890,
      title: 'Test Movie',
      original_title: 'Test Movie Original',
      overview: 'A test movie overview',
      release_date: '2020-01-01',
      poster_path: '/poster.jpg',
      backdrop_path: '/backdrop.jpg',
      vote_average: 7.5,
      vote_count: 50,
      genre_ids: [1, 2],
      popularity: 75.5,
      adult: false,
      video: false,
    },
    files: ['movie.mkv'],
  }

  it('should minimize TV show metadata with files', () => {
    const result = minimize(mockTvShowMetadata)

    expect(result.mediaFolderPath).toBe('/media/tvshows/Test Show')
    expect(result.type).toBe('tvshow-folder')
    expect(result.name).toBe('Test TV Show')
    expect(result.files).toBe('3 files')
    expect(result.tmdbTvShow).toEqual({
      id: 12345,
      name: 'Test TV Show',
    })
    expect(result.tmdbMovie).toEqual({
      id: undefined,
      title: undefined,
    })
  })

  it('should minimize movie metadata with files', () => {
    const result = minimize(mockMovieMetadata)

    expect(result.mediaFolderPath).toBe('/media/movies/Test Movie')
    expect(result.type).toBe('movie-folder')
    expect(result.name).toBeUndefined()
    expect(result.files).toBe('1 files')
    expect(result.tmdbTvShow).toEqual({
      id: undefined,
      name: undefined,
    })
    expect(result.tmdbMovie).toEqual({
      id: 67890,
      title: 'Test Movie',
    })
  })

  it('should handle metadata with undefined files', () => {
    const metadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/tvshows/Test Show',
      type: 'tvshow-folder',
      tmdbTvShow: {
        id: 12345,
        name: 'Test TV Show',
        overview: '',
        first_air_date: '',
        poster_path: null,
        backdrop_path: null,
        vote_average: 0,
        vote_count: 0,
        genre_ids: [],
        origin_country: [],
        original_name: '',
        popularity: 0,
        number_of_seasons: 0,
        number_of_episodes: 0,
        seasons: [],
        status: '',
        type: '',
        in_production: false,
        last_air_date: '',
        networks: [],
        production_companies: [],
      },
      files: undefined,
    }

    const result = minimize(metadata)

    expect(result.files).toBe('undefined')
    expect(result.tmdbTvShow).toEqual({
      id: 12345,
      name: 'Test TV Show',
    })
  })

  it('should handle metadata with null files', () => {
    const metadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/movies/Test Movie',
      type: 'movie-folder',
      tmdbMovie: {
        id: 67890,
        title: 'Test Movie',
        original_title: '',
        overview: '',
        release_date: '',
        poster_path: null,
        backdrop_path: null,
        vote_average: 0,
        vote_count: 0,
        genre_ids: [],
        popularity: 0,
        adult: false,
        video: false,
      },
      files: null,
    }

    const result = minimize(metadata)

    expect(result.files).toBe('null')
    expect(result.tmdbMovie).toEqual({
      id: 67890,
      title: 'Test Movie',
    })
  })

  it('should handle empty files array', () => {
    const metadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/tvshows/Empty Show',
      type: 'tvshow-folder',
      tmdbTvShow: {
        id: 11111,
        name: 'Empty Show',
        overview: '',
        first_air_date: '',
        poster_path: null,
        backdrop_path: null,
        vote_average: 0,
        vote_count: 0,
        genre_ids: [],
        origin_country: [],
        original_name: '',
        popularity: 0,
        number_of_seasons: 0,
        number_of_episodes: 0,
        seasons: [],
        status: '',
        type: '',
        in_production: false,
        last_air_date: '',
        networks: [],
        production_companies: [],
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
    expect(result.tmdbTvShow).toEqual({
      id: undefined,
      name: undefined,
    })
    expect(result.tmdbMovie).toEqual({
      id: undefined,
      title: undefined,
    })
  })

  it('should handle metadata with only tmdbTvShow', () => {
    const metadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/tvshows/Only Show',
      type: 'tvshow-folder',
      tmdbTvShow: {
        id: 22222,
        name: 'Only TV Show',
        overview: '',
        first_air_date: '',
        poster_path: null,
        backdrop_path: null,
        vote_average: 0,
        vote_count: 0,
        genre_ids: [],
        origin_country: [],
        original_name: '',
        popularity: 0,
        number_of_seasons: 0,
        number_of_episodes: 0,
        seasons: [],
        status: '',
        type: '',
        in_production: false,
        last_air_date: '',
        networks: [],
        production_companies: [],
      },
    }

    const result = minimize(metadata)

    expect(result.mediaFolderPath).toBe('/media/tvshows/Only Show')
    expect(result.type).toBe('tvshow-folder')
    expect(result.name).toBe('Only TV Show')
    expect(result.files).toBe('undefined')
    expect(result.tmdbTvShow).toEqual({
      id: 22222,
      name: 'Only TV Show',
    })
    expect(result.tmdbMovie).toEqual({
      id: undefined,
      title: undefined,
    })
  })

  it('should handle metadata with only tmdbMovie', () => {
    const metadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/movies/Only Movie',
      type: 'movie-folder',
      tmdbMovie: {
        id: 33333,
        title: 'Only Movie',
        original_title: '',
        overview: '',
        release_date: '',
        poster_path: null,
        backdrop_path: null,
        vote_average: 0,
        vote_count: 0,
        genre_ids: [],
        popularity: 0,
        adult: false,
        video: false,
      },
    }

    const result = minimize(metadata)

    expect(result.mediaFolderPath).toBe('/media/movies/Only Movie')
    expect(result.type).toBe('movie-folder')
    expect(result.name).toBeUndefined()
    expect(result.files).toBe('undefined')
    expect(result.tmdbTvShow).toEqual({
      id: undefined,
      name: undefined,
    })
    expect(result.tmdbMovie).toEqual({
      id: 33333,
      title: 'Only Movie',
    })
  })

  it('should handle metadata with neither tmdbTvShow nor tmdbMovie', () => {
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
    expect(result.tmdbTvShow).toEqual({
      id: undefined,
      name: undefined,
    })
    expect(result.tmdbMovie).toEqual({
      id: undefined,
      title: undefined,
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

  it('should correctly extract name from tmdbTvShow', () => {
    const metadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/tvshows/Named Show',
      type: 'tvshow-folder',
      tmdbTvShow: {
        id: 44444,
        name: 'This Is The Name',
        overview: '',
        first_air_date: '',
        poster_path: null,
        backdrop_path: null,
        vote_average: 0,
        vote_count: 0,
        genre_ids: [],
        origin_country: [],
        original_name: '',
        popularity: 0,
        number_of_seasons: 0,
        number_of_episodes: 0,
        seasons: [],
        status: '',
        type: '',
        in_production: false,
        last_air_date: '',
        networks: [],
        production_companies: [],
      },
    }

    const result = minimize(metadata)

    expect(result.name).toBe('This Is The Name')
  })

  it('should minimize TV show metadata with partial TMDB data', () => {
    const metadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/tvshows/Partial Show',
      type: 'tvshow-folder',
      tmdbTvShow: {
        id: 55555,
        name: 'Partial TV Show',
        overview: '',
        first_air_date: '',
        poster_path: null,
        backdrop_path: null,
        vote_average: 0,
        vote_count: 0,
        genre_ids: [],
        origin_country: [],
        original_name: '',
        popularity: 0,
        number_of_seasons: 0,
        number_of_episodes: 0,
        seasons: [],
        status: '',
        type: '',
        in_production: false,
        last_air_date: '',
        networks: [],
        production_companies: [],
      },
    }

    const result = minimize(metadata)

    expect(result.name).toBe('Partial TV Show')
    expect(result.tmdbTvShow).toEqual({
      id: 55555,
      name: 'Partial TV Show',
    })
  })

  it('should minimize movie metadata with partial TMDB data', () => {
    const metadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/movies/Partial Movie',
      type: 'movie-folder',
      tmdbMovie: {
        id: 66666,
        title: 'Partial Movie',
        original_title: '',
        overview: '',
        release_date: '',
        poster_path: null,
        backdrop_path: null,
        vote_average: 0,
        vote_count: 0,
        genre_ids: [],
        popularity: 0,
        adult: false,
        video: false,
      },
    }

    const result = minimize(metadata)

    expect(result.tmdbMovie).toEqual({
      id: 66666,
      title: 'Partial Movie',
    })
  })
})
