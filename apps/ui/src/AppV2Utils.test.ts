import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getTmdbIdFromFolderName, doPreprocessMediaFolder } from './AppV2Utils'
import { recognizeMediaFolder } from './lib/recognizeMediaFolder'
import { recognizeTvShowMediaFiles } from './lib/recognizeMediaFiles'
import { recognizeEpisodesAsync } from './lib/recognizeEpisodes'
import { getTvShowById } from './api/tmdb'
import type { UIMediaMetadata } from './types/UIMediaMetadata'
import type { TMDBTVShowDetails } from '@core/types'

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

  describe('when tmdbTvShow has undefined seasons', () => {
    it('should call getTvShowById to fetch full season data', async () => {
      const inputMetadata: UIMediaMetadata = {
        status: 'idle',
        type: 'tvshow-folder',
        mediaFolderPath: '/path/to/TV Show',
        tmdbTvShow: {
          id: 12345,
          name: 'Test TV Show',
          original_name: 'Test TV Show',
          overview: 'Test overview',
          poster_path: null,
          backdrop_path: null,
          first_air_date: '2020-01-01',
          vote_average: 8.5,
          vote_count: 100,
          popularity: 50,
          genre_ids: [1, 2],
          origin_country: ['US'],
          number_of_seasons: 2,
          number_of_episodes: 20,
          status: 'Ended',
          type: 'Scripted',
          in_production: false,
          last_air_date: '2021-01-01',
          networks: [],
          production_companies: [],
          // seasons is undefined
        } as unknown as TMDBTVShowDetails,
      }

      const fullTvShowData: TMDBTVShowDetails = {
        ...inputMetadata.tmdbTvShow!,
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
      mockGetTvShowById.mockResolvedValue({
        data: fullTvShowData,
      })

      const onSuccess = vi.fn()

      await doPreprocessMediaFolder(inputMetadata, { onSuccess })

      expect(mockGetTvShowById).toHaveBeenCalledWith(12345, 'zh-CN')
      // Verify getTvShowById was called before recognizeEpisodesAsync
      expect(mockGetTvShowById.mock.invocationCallOrder[0]).toBeLessThan(
        mockRecognizeEpisodesAsync.mock.invocationCallOrder[0]
      )
      expect(onSuccess).toHaveBeenCalled()
      const result = onSuccess.mock.calls[0][0]
      expect(result.tmdbTvShow.seasons).toHaveLength(1)
    })
  })

  describe('when tmdbTvShow has empty seasons array', () => {
    it('should call getTvShowById to fetch full season data', async () => {
      const inputMetadata: UIMediaMetadata = {
        status: 'idle',
        type: 'tvshow-folder',
        mediaFolderPath: '/path/to/TV Show',
        tmdbTvShow: {
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
          seasons: [], // empty seasons array
        } as TMDBTVShowDetails,
      }

      const fullTvShowData: TMDBTVShowDetails = {
        ...inputMetadata.tmdbTvShow!,
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
      mockGetTvShowById.mockResolvedValue({
        data: fullTvShowData,
      })

      const onSuccess = vi.fn()

      await doPreprocessMediaFolder(inputMetadata, { onSuccess })

      expect(mockGetTvShowById).toHaveBeenCalledWith(67890, 'zh-CN')
      // Verify getTvShowById was called before recognizeEpisodesAsync
      expect(mockGetTvShowById.mock.invocationCallOrder[0]).toBeLessThan(
        mockRecognizeEpisodesAsync.mock.invocationCallOrder[0]
      )
      expect(onSuccess).toHaveBeenCalled()
      const result = onSuccess.mock.calls[0][0]
      expect(result.tmdbTvShow.seasons).toHaveLength(1)
    })
  })

  describe('when getTvShowById returns an error', () => {
    it('should not update tmdbTvShow when resp.error is defined', async () => {
      const inputMetadata: UIMediaMetadata = {
        status: 'idle',
        type: 'tvshow-folder',
        mediaFolderPath: '/path/to/TV Show',
        tmdbTvShow: {
          id: 22222,
          name: 'Error TV Show',
          original_name: 'Error TV Show',
          overview: 'Error overview',
          poster_path: null,
          backdrop_path: null,
          first_air_date: '2022-01-01',
          vote_average: 6.0,
          vote_count: 10,
          popularity: 5,
          genre_ids: [1],
          origin_country: ['US'],
          number_of_seasons: 1,
          number_of_episodes: 10,
          status: 'Returning',
          type: 'Scripted',
          in_production: true,
          last_air_date: '2022-06-01',
          networks: [],
          production_companies: [],
          // seasons is undefined
        } as unknown as TMDBTVShowDetails,
      }

      mockRecognizeMediaFolder.mockResolvedValue(inputMetadata)
      mockRecognizeTvShowMediaFiles.mockReturnValue([
        { videoFilePath: '/path/to/video.mkv', season: 1, episode: 1 },
      ])
      mockRecognizeEpisodesAsync.mockResolvedValue([
        { season: 1, episode: 1, file: '/path/to/video.mkv' },
      ])
      mockGetTvShowById.mockResolvedValue({
        error: 'API rate limit exceeded',
      })

      const onSuccess = vi.fn()

      await doPreprocessMediaFolder(inputMetadata, { onSuccess })

      expect(mockGetTvShowById).toHaveBeenCalledWith(22222, 'zh-CN')
      // Verify getTvShowById was called before recognizeEpisodesAsync
      expect(mockGetTvShowById.mock.invocationCallOrder[0]).toBeLessThan(
        mockRecognizeEpisodesAsync.mock.invocationCallOrder[0]
      )
      expect(onSuccess).toHaveBeenCalled()
      const result = onSuccess.mock.calls[0][0]
      // tmdbTvShow should remain unchanged (no seasons)
      expect(result.tmdbTvShow.seasons).toBeUndefined()
    })
  })

  describe('when getTvShowById returns undefined data', () => {
    it('should not update tmdbTvShow when resp.data is undefined', async () => {
      const inputMetadata: UIMediaMetadata = {
        status: 'idle',
        type: 'tvshow-folder',
        mediaFolderPath: '/path/to/TV Show',
        tmdbTvShow: {
          id: 33333,
          name: 'Undefined Data TV Show',
          original_name: 'Undefined Data TV Show',
          overview: 'Undefined overview',
          poster_path: null,
          backdrop_path: null,
          first_air_date: '2023-01-01',
          vote_average: 5.0,
          vote_count: 5,
          popularity: 1,
          genre_ids: [1],
          origin_country: ['US'],
          number_of_seasons: 1,
          number_of_episodes: 10,
          status: 'Returning',
          type: 'Scripted',
          in_production: true,
          last_air_date: '2023-06-01',
          networks: [],
          production_companies: [],
          seasons: [], // empty seasons array
        } as TMDBTVShowDetails,
      }

      mockRecognizeMediaFolder.mockResolvedValue(inputMetadata)
      mockRecognizeTvShowMediaFiles.mockReturnValue([
        { videoFilePath: '/path/to/video.mkv', season: 1, episode: 1 },
      ])
      mockRecognizeEpisodesAsync.mockResolvedValue([
        { season: 1, episode: 1, file: '/path/to/video.mkv' },
      ])
      mockGetTvShowById.mockResolvedValue({
        // data is undefined, no error
      })

      const onSuccess = vi.fn()

      await doPreprocessMediaFolder(inputMetadata, { onSuccess })

      expect(mockGetTvShowById).toHaveBeenCalledWith(33333, 'zh-CN')
      // Verify getTvShowById was called before recognizeEpisodesAsync
      expect(mockGetTvShowById.mock.invocationCallOrder[0]).toBeLessThan(
        mockRecognizeEpisodesAsync.mock.invocationCallOrder[0]
      )
      expect(onSuccess).toHaveBeenCalled()
      const result = onSuccess.mock.calls[0][0]
      // tmdbTvShow should remain unchanged (empty seasons)
      expect(result.tmdbTvShow.seasons).toEqual([])
    })
  })

  describe('when tmdbTvShow already has seasons', () => {
    it('should NOT call getTvShowById', async () => {
      const inputMetadata: UIMediaMetadata = {
        status: 'idle',
        type: 'tvshow-folder',
        mediaFolderPath: '/path/to/TV Show',
        tmdbTvShow: {
          id: 11111,
          name: 'Complete TV Show',
          original_name: 'Complete TV Show',
          overview: 'Complete overview',
          poster_path: null,
          backdrop_path: null,
          first_air_date: '2021-01-01',
          vote_average: 9.0,
          vote_count: 200,
          popularity: 100,
          genre_ids: [1],
          origin_country: ['US'],
          number_of_seasons: 1,
          number_of_episodes: 10,
          status: 'Ended',
          type: 'Scripted',
          in_production: false,
          last_air_date: '2021-12-01',
          networks: [],
          production_companies: [],
          seasons: [
            {
              id: 3,
              name: 'Season 1',
              overview: 'Season 1 overview',
              poster_path: null,
              season_number: 1,
              air_date: '2021-01-01',
              episode_count: 10,
            },
          ],
        } as TMDBTVShowDetails,
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
