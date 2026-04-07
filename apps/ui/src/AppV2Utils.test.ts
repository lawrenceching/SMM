import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getTmdbIdFromFolderName,
  doPreprocessMediaFolder,
  buildMediaFolderListItemV2PropsByUIMediaMetadatas,
} from './AppV2Utils'
import { recognizeMediaFolder } from './lib/recognizeMediaFolder'
import { recognizeTvShowMediaFiles } from './lib/recognizeMediaFiles'
import { recognizeEpisodesAsync } from './lib/recognizeEpisodes'
import { getTvShowById } from './api/tmdb'
import type { UIMediaMetadata } from './types/UIMediaMetadata'
import type { TMDBTVShowDetails, TvShowMediaMetadata } from '@core/types'

vi.mock('./lib/recognizeMediaFolder')
vi.mock('./lib/recognizeMediaFiles')
vi.mock('./lib/recognizeEpisodes')
vi.mock('./api/tmdb')

describe('getTmdbIdFromFolderName', () => {

  it('use case 1', () => {
    const result = getTmdbIdFromFolderName('爱杀宝贝 (2012) [tmdbid=73598]')
    expect(result).toBe('73598')
  })

  describe('valid patterns with parentheses', () => {
    it('should extract TMDB ID from pattern (tmdbid=123456)', () => {
      const result = getTmdbIdFromFolderName('TV Show (tmdbid=123456)')
      expect(result).toBe('123456')
    })

    it('should extract TMDB ID from pattern (tmdbid=1)', () => {
      const result = getTmdbIdFromFolderName('Movie (tmdbid=1)')
      expect(result).toBe('1')
    })

    it('should extract TMDB ID with extra spaces in pattern ( tmdbid = 123456 )', () => {
      const result = getTmdbIdFromFolderName('TV Show ( tmdbid = 123456 )')
      expect(result).toBe('123456')
    })

    it('should extract TMDB ID from full folder path (tmdbid=123456)', () => {
      const result = getTmdbIdFromFolderName('/path/to/TV Show (tmdbid=123456)')
      expect(result).toBe('123456')
    })
  })

  describe('valid patterns with curly braces', () => {
    it('should extract TMDB ID from pattern {tmdbid=123456}', () => {
      const result = getTmdbIdFromFolderName('TV Show {tmdbid=123456}')
      expect(result).toBe('123456')
    })

    it('should extract TMDB ID from pattern {tmdbid=1}', () => {
      const result = getTmdbIdFromFolderName('Movie {tmdbid=1}')
      expect(result).toBe('1')
    })

    it('should extract TMDB ID with extra spaces in pattern { tmdbid = 123456 }', () => {
      const result = getTmdbIdFromFolderName('TV Show { tmdbid = 123456 }')
      expect(result).toBe('123456')
    })

    it('should extract TMDB ID from full folder path {tmdbid=123456}', () => {
      const result = getTmdbIdFromFolderName('/path/to/TV Show {tmdbid=123456}')
      expect(result).toBe('123456')
    })
  })

  describe('case insensitivity', () => {
    it('should extract TMDB ID with uppercase T (tmdbid=123456)', () => {
      const result = getTmdbIdFromFolderName('TV Show (Tmdbid=123456)')
      expect(result).toBe('123456')
    })

    it('should extract TMDB ID with all uppercase (TMDBID=123456)', () => {
      const result = getTmdbIdFromFolderName('TV Show (TMDBID=123456)')
      expect(result).toBe('123456')
    })

    it('should extract TMDB ID with mixed case (TmDbId=123456)', () => {
      const result = getTmdbIdFromFolderName('TV Show (TmDbId=123456)')
      expect(result).toBe('123456')
    })

    it('should extract TMDB ID with curly braces and mixed case {tMdBiD=123456}', () => {
      const result = getTmdbIdFromFolderName('TV Show {tMdBiD=123456}')
      expect(result).toBe('123456')
    })
  })

  describe('complex folder names', () => {
    it('should extract TMDB ID from folder with year and TMDB ID', () => {
      const result = getTmdbIdFromFolderName('TV Show (2020) (tmdbid=123456)')
      expect(result).toBe('123456')
    })

    it('should extract TMDB ID from folder with quality tag', () => {
      const result = getTmdbIdFromFolderName('TV Show [1080p] (tmdbid=123456)')
      expect(result).toBe('123456')
    })

    it('should extract TMDB ID from folder with multiple parentheses', () => {
      const result = getTmdbIdFromFolderName('TV Show (2020) (Season 1) (tmdbid=123456)')
      expect(result).toBe('123456')
    })

    it('should extract TMDB ID from folder with special characters in name', () => {
      const result = getTmdbIdFromFolderName('TV Show: The Beginning (tmdbid=123456)')
      expect(result).toBe('123456')
    })

    it('should extract TMDB ID from folder with underscores', () => {
      const result = getTmdbIdFromFolderName('TV_Show_Season_1 (tmdbid=123456)')
      expect(result).toBe('123456')
    })

    it('should extract TMDB ID from folder with hyphens', () => {
      const result = getTmdbIdFromFolderName('TV-Show-Season-1 (tmdbid=123456)')
      expect(result).toBe('123456')
    })
  })

  describe('large TMDB IDs', () => {
    it('should extract large TMDB ID (7 digits)', () => {
      const result = getTmdbIdFromFolderName('TV Show (tmdbid=1234567)')
      expect(result).toBe('1234567')
    })

    it('should extract very large TMDB ID (8 digits)', () => {
      const result = getTmdbIdFromFolderName('Movie {tmdbid=12345678}')
      expect(result).toBe('12345678')
    })
  })

  describe('invalid patterns', () => {
    it('should return null when no TMDB ID pattern is present', () => {
      const result = getTmdbIdFromFolderName('TV Show')
      expect(result).toBeNull()
    })

    it('should return null when TMDB ID is missing (tmdbid=)', () => {
      const result = getTmdbIdFromFolderName('TV Show (tmdbid=)')
      expect(result).toBeNull()
    })

    it('should return null when TMDB ID contains letters (tmdbid=abc)', () => {
      const result = getTmdbIdFromFolderName('TV Show (tmdbid=abc)')
      expect(result).toBeNull()
    })

    it('should return null when TMDB ID contains mixed alphanumeric (tmdbid=12abc34)', () => {
      const result = getTmdbIdFromFolderName('TV Show {tmdbid=12abc34}')
      expect(result).toBeNull()
    })

    it('should return null when pattern has only opening parenthesis', () => {
      const result = getTmdbIdFromFolderName('TV Show (tmdbid=123456')
      expect(result).toBeNull()
    })

    it('should return null when pattern has only opening curly brace', () => {
      const result = getTmdbIdFromFolderName('TV Show {tmdbid=123456')
      expect(result).toBeNull()
    })

    it('should return null when pattern has only closing parenthesis', () => {
      const result = getTmdbIdFromFolderName('TV Show tmdbid=123456)')
      expect(result).toBeNull()
    })

    it('should return null when pattern has only closing curly brace', () => {
      const result = getTmdbIdFromFolderName('TV Show tmdbid=123456}')
      expect(result).toBeNull()
    })

    it('should extract TMDB ID from pattern [tmdbid=123456]', () => {
      const result = getTmdbIdFromFolderName('TV Show [tmdbid=123456]')
      expect(result).toBe('123456')
    })

    it('should return null when using angle brackets <tmdbid=123456>', () => {
      const result = getTmdbIdFromFolderName('TV Show <tmdbid=123456>')
      expect(result).toBeNull()
    })

    it('should return null when keyword is misspelled', () => {
      const result = getTmdbIdFromFolderName('TV Show (tmdbiid=123456)')
      expect(result).toBeNull()
    })

    it('should return null when there are no delimiters', () => {
      const result = getTmdbIdFromFolderName('TV Show tmdbid=123456')
      expect(result).toBeNull()
    })

    it('should return null for empty string', () => {
      const result = getTmdbIdFromFolderName('')
      expect(result).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('should extract first TMDB ID when multiple patterns exist', () => {
      const result = getTmdbIdFromFolderName('TV Show (tmdbid=123456) (tmdbid=789012)')
      expect(result).toBe('123456')
    })

    it('should extract TMDB ID with leading zeros (tmdbid=00123)', () => {
      const result = getTmdbIdFromFolderName('TV Show (tmdbid=00123)')
      expect(result).toBe('00123')
    })

    it('should extract TMDB ID from pattern with no spaces around equals', () => {
      const result = getTmdbIdFromFolderName('TV Show (tmdbid=123456)')
      expect(result).toBe('123456')
    })

    it('should extract TMDB ID from pattern with spaces before and after ID', () => {
      const result = getTmdbIdFromFolderName('TV Show (tmdbid= 123456 )')
      expect(result).toBe('123456')
    })

    it('should work with Unicode characters in folder name', () => {
      const result = getTmdbIdFromFolderName('电视剧 (tmdbid=123456)')
      expect(result).toBe('123456')
    })

    it('should work with emojis in folder name', () => {
      const result = getTmdbIdFromFolderName('TV Show 📺 (tmdbid=123456)')
      expect(result).toBe('123456')
    })
  })
})

describe('buildMediaFolderListItemV2PropsByUIMediaMetadatas', () => {
  it('returns an empty array when input is empty', () => {
    expect(buildMediaFolderListItemV2PropsByUIMediaMetadatas([])).toEqual([])
  })

  it('maps tvshow, movie, and music folders with correct mediaName and mediaType', () => {
    const metadatas: UIMediaMetadata[] = [
      {
        status: 'ok',
        type: 'tvshow-folder',
        mediaFolderPath: '/media/shows/BCS',
        tvShow: {
          id: '60059',
          name: 'Better Call Saul',
          database: 'TMDB',
          seasons: [],
        },
      },
      {
        status: 'ok',
        type: 'movie-folder',
        mediaFolderPath: '/media/movies/Inception.2010.1080p',
        movie: {
          id: '27205',
          name: 'Inception',
          database: 'TMDB',
        },
      },
      {
        status: 'ok',
        type: 'music-folder',
        mediaFolderPath: '/media/library/Artist Name/Album Title',
      },
    ]
    expect(buildMediaFolderListItemV2PropsByUIMediaMetadatas(metadatas)).toEqual([
      {
        mediaName: 'Better Call Saul',
        path: '/media/shows/BCS',
        mediaType: 'tvshow',
        status: 'ok',
      },
      {
        mediaName: 'Inception',
        path: '/media/movies/Inception.2010.1080p',
        mediaType: 'movie',
        status: 'ok',
      },
      {
        mediaName: 'Album Title',
        path: '/media/library/Artist Name/Album Title',
        mediaType: 'tvshow-folder',
        status: 'ok',
      },
    ])
  })

  it('tvshow-folder falls back to folder basename when tvShow is missing', () => {
    const metadatas: UIMediaMetadata[] = [
      {
        status: 'idle',
        type: 'tvshow-folder',
        mediaFolderPath: '/media/shows/Unmatched Name',
      },
    ]
    expect(buildMediaFolderListItemV2PropsByUIMediaMetadatas(metadatas)).toEqual([
      {
        mediaName: 'Unmatched Name',
        path: '/media/shows/Unmatched Name',
        mediaType: 'tvshow',
        status: 'idle',
      },
    ])
  })

  it('movie-folder uses movie.name when movie metadata is present', () => {
    const metadatas: UIMediaMetadata[] = [
      {
        status: 'loading',
        type: 'movie-folder',
        mediaFolderPath: '/media/movies/Blade Runner 2049 (2017)',
        movie: {
          id: '335984',
          name: 'Blade Runner 2049',
          database: 'TMDB',
        },
      },
    ]
    expect(buildMediaFolderListItemV2PropsByUIMediaMetadatas(metadatas)).toEqual([
      {
        mediaName: 'Blade Runner 2049',
        path: '/media/movies/Blade Runner 2049 (2017)',
        mediaType: 'movie',
        status: 'loading',
      },
    ])
  })

  it('movie-folder falls back to basename when neither tvShow nor movie is present', () => {
    const metadatas: UIMediaMetadata[] = [
      {
        status: 'loading',
        type: 'movie-folder',
        mediaFolderPath: '/media/movies/Inception',
      },
    ]
    expect(buildMediaFolderListItemV2PropsByUIMediaMetadatas(metadatas)).toEqual([
      {
        mediaName: 'Inception',
        path: '/media/movies/Inception',
        mediaType: 'movie',
        status: 'loading',
      },
    ])
  })

  it('movie-folder prefers tvShow.name over movie.name when both are present', () => {
    const metadatas: UIMediaMetadata[] = [
      {
        status: 'ok',
        type: 'movie-folder',
        mediaFolderPath: '/media/movies/folder-name',
        tvShow: {
          id: '99',
          name: 'Title From TvShow',
          database: 'TMDB',
          seasons: [],
        },
        movie: {
          id: '100',
          name: 'Title From Movie',
          database: 'TMDB',
        },
      },
    ]
    expect(buildMediaFolderListItemV2PropsByUIMediaMetadatas(metadatas)[0].mediaName).toBe(
      'Title From TvShow'
    )
  })

  it('music-folder uses folder basename for mediaName and mediaType tvshow-folder', () => {
    const metadatas: UIMediaMetadata[] = [
      {
        status: 'ok',
        type: 'music-folder',
        mediaFolderPath: '/media/music/My Album',
      },
    ]
    expect(buildMediaFolderListItemV2PropsByUIMediaMetadatas(metadatas)).toEqual([
      {
        mediaName: 'My Album',
        path: '/media/music/My Album',
        mediaType: 'tvshow-folder',
        status: 'ok',
      },
    ])
  })

  it('preserves input order', () => {
    const a: UIMediaMetadata = {
      status: 'ok',
      type: 'tvshow-folder',
      mediaFolderPath: '/a',
      tvShow: { id: '1', name: 'A', database: 'TMDB', seasons: [] },
    }
    const b: UIMediaMetadata = {
      status: 'ok',
      type: 'movie-folder',
      mediaFolderPath: '/movies/B',
      movie: { id: '2', name: 'Movie B', database: 'TMDB' },
    }
    const c: UIMediaMetadata = {
      status: 'ok',
      type: 'music-folder',
      mediaFolderPath: '/music/C',
    }
    const result = buildMediaFolderListItemV2PropsByUIMediaMetadatas([a, b, c])
    expect(result.map((r) => r.path)).toEqual(['/a', '/movies/B', '/music/C'])
    expect(result.map((r) => r.mediaName)).toEqual(['A', 'Movie B', 'C'])
  })
})

describe('doPreprocessMediaFolder', () => {
  const mockRecognizeMediaFolder = vi.mocked(recognizeMediaFolder)
  const mockRecognizeTvShowMediaFiles = vi.mocked(recognizeTvShowMediaFiles)
  const mockRecognizeEpisodesAsync = vi.mocked(recognizeEpisodesAsync)
  const mockGetTvShowById = vi.mocked(getTvShowById)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('when tvShow has undefined seasons', () => {
    it('should call getTvShowById to fetch full season data', async () => {
      const inputMetadata: UIMediaMetadata = {
        status: 'idle',
        type: 'tvshow-folder',
        mediaFolderPath: '/path/to/TV Show',
        tvShow: {
          id: '12345',
          name: 'TV Show',
          database: 'TMDB',
          // seasons is undefined
        } as unknown as TvShowMediaMetadata,
      }

      const fullTvShowData: TMDBTVShowDetails = {
        id: 12345,
        name: 'TV Show',
        original_name: 'TV Show',
        overview: '',
        poster_path: null,
        backdrop_path: null,
        first_air_date: '2020-01-01',
        vote_average: 0,
        vote_count: 0,
        popularity: 0,
        genre_ids: [],
        origin_country: [],
        number_of_seasons: 1,
        number_of_episodes: 10,
        status: 'Ended',
        type: 'Scripted',
        in_production: false,
        last_air_date: '2020-12-01',
        networks: [],
        production_companies: [],
        seasons: [
          {
            id: 1,
            name: 'Season 1',
            overview: 'Season 1 overview',
            poster_path: null,
            season_number: 1,
            air_date: '2020-01-01',
            episode_count: 10,
          },
        ],
      }

      mockRecognizeMediaFolder.mockResolvedValue(inputMetadata)
      mockRecognizeTvShowMediaFiles.mockReturnValue([
        { videoFilePath: '/path/to/video.mkv', season: 1, episode: 1 },
      ])
      mockRecognizeEpisodesAsync.mockResolvedValue([
        { season: 1, episode: 1, file: '/path/to/video.mkv' },
      ])
      mockGetTvShowById.mockResolvedValue(fullTvShowData)

      const onSuccess = vi.fn()

      await doPreprocessMediaFolder(inputMetadata, { onSuccess })

      expect(mockGetTvShowById).toHaveBeenCalledWith(12345, 'en-US', undefined)
      // Verify getTvShowById was called before recognizeEpisodesAsync
      expect(mockGetTvShowById.mock.invocationCallOrder[0]).toBeLessThan(
        mockRecognizeEpisodesAsync.mock.invocationCallOrder[0]
      )
      expect(onSuccess).toHaveBeenCalled()
      const result = onSuccess.mock.calls[0][0]
      expect(result.tvShow?.seasons).toHaveLength(1)
    })
  })

  describe('when tvShow has empty seasons array', () => {
    it('should call getTvShowById to fetch full season data', async () => {
      const inputMetadata: UIMediaMetadata = {
        status: 'idle',
        type: 'tvshow-folder',
        mediaFolderPath: '/path/to/TV Show',
        tvShow: {
          id: '67890',
          name: 'Another TV Show',
          database: 'TMDB',
          seasons: [],
        },
      }

      const fullTvShowData: TMDBTVShowDetails = {
        id: 67890,
        name: 'Another TV Show',
        original_name: 'Another TV Show',
        overview: 'Another overview',
        poster_path: null,
        backdrop_path: null,
        first_air_date: '2019-01-01',
        vote_average: 7.5,
        vote_count: 50,
        popularity: 30,
        genre_ids: [3],
        origin_country: ['UK'],
        number_of_seasons: 1,
        number_of_episodes: 10,
        status: 'Ended',
        type: 'Scripted',
        in_production: false,
        last_air_date: '2019-12-01',
        networks: [],
        production_companies: [],
        seasons: [
          {
            id: 2,
            name: 'Season 1',
            overview: 'Season 1 overview',
            poster_path: null,
            season_number: 1,
            air_date: '2019-01-01',
            episode_count: 10,
          },
        ],
      }

      mockRecognizeMediaFolder.mockResolvedValue(inputMetadata)
      mockRecognizeTvShowMediaFiles.mockReturnValue([
        { videoFilePath: '/path/to/video.mkv', season: 1, episode: 1 },
      ])
      mockRecognizeEpisodesAsync.mockResolvedValue([
        { season: 1, episode: 1, file: '/path/to/video.mkv' },
      ])
      mockGetTvShowById.mockResolvedValue(fullTvShowData)

      const onSuccess = vi.fn()

      await doPreprocessMediaFolder(inputMetadata, { onSuccess })

      expect(mockGetTvShowById).toHaveBeenCalledWith(67890, 'en-US', undefined)
      // Verify getTvShowById was called before recognizeEpisodesAsync
      expect(mockGetTvShowById.mock.invocationCallOrder[0]).toBeLessThan(
        mockRecognizeEpisodesAsync.mock.invocationCallOrder[0]
      )
      expect(onSuccess).toHaveBeenCalled()
      const result = onSuccess.mock.calls[0][0]
      expect(result.tvShow?.seasons).toHaveLength(1)
    })
  })

  describe('when getTvShowById throws an error', () => {
    it('should not update tvShow when getTvShowById throws', async () => {
      const inputMetadata: UIMediaMetadata = {
        status: 'idle',
        type: 'tvshow-folder',
        mediaFolderPath: '/path/to/TV Show',
        tvShow: {
          id: '22222',
          name: 'Error TV Show',
          database: 'TMDB',
          // seasons is undefined
        } as unknown as TvShowMediaMetadata,
      }

      mockRecognizeMediaFolder.mockResolvedValue(inputMetadata)
      mockRecognizeTvShowMediaFiles.mockReturnValue([
        { videoFilePath: '/path/to/video.mkv', season: 1, episode: 1 },
      ])
      mockRecognizeEpisodesAsync.mockResolvedValue([
        { season: 1, episode: 1, file: '/path/to/video.mkv' },
      ])
      mockGetTvShowById.mockRejectedValue(new Error('API rate limit exceeded'))

      const onSuccess = vi.fn()

      await doPreprocessMediaFolder(inputMetadata, { onSuccess })

      expect(mockGetTvShowById).toHaveBeenCalledWith(22222, 'en-US', undefined)
      // Verify getTvShowById was called before recognizeEpisodesAsync
      expect(mockGetTvShowById.mock.invocationCallOrder[0]).toBeLessThan(
        mockRecognizeEpisodesAsync.mock.invocationCallOrder[0]
      )
      expect(onSuccess).toHaveBeenCalled()
      const result = onSuccess.mock.calls[0][0]
      // tvShow should remain unchanged (no seasons)
      expect(result.tvShow?.seasons).toBeUndefined()
    })
  })

  describe('when tvShow already has seasons', () => {
    it('should NOT call getTvShowById', async () => {
      const inputMetadata: UIMediaMetadata = {
        status: 'idle',
        type: 'tvshow-folder',
        mediaFolderPath: '/path/to/TV Show',
        tvShow: {
          id: '11111',
          name: 'Complete TV Show',
          database: 'TMDB',
          seasons: [
            {
              season: 1,
              name: 'Season 1',
              episodes: [],
            },
          ],
        },
      }

      mockRecognizeMediaFolder.mockResolvedValue(inputMetadata)
      mockRecognizeTvShowMediaFiles.mockReturnValue([
        { videoFilePath: '/path/to/video.mkv', season: 1, episode: 1 },
      ])
      mockRecognizeEpisodesAsync.mockResolvedValue([
        { season: 1, episode: 1, file: '/path/to/video.mkv' },
      ])

      const onSuccess = vi.fn()

      await doPreprocessMediaFolder(inputMetadata, { onSuccess })

      expect(mockGetTvShowById).not.toHaveBeenCalled()
      expect(onSuccess).toHaveBeenCalled()
    })
  })
})
