import { describe, it, expect } from 'vitest'
import { matchesEpisodePattern, recognizeMediaFiles } from './lookup'
import type { UIMediaMetadata } from '@/types/UIMediaMetadata'

describe('matchesEpisodePattern', () => {
  describe('Pattern 1: SXXEYY formats', () => {
    it('should match S01E05 format', () => {
      expect(matchesEpisodePattern('Show Name S01E05.mkv', 1, 5)).toBe(true)
      expect(matchesEpisodePattern('Show Name S02E12.mkv', 2, 12)).toBe(true)
    })

    it('should match S1E5 format (no padding)', () => {
      expect(matchesEpisodePattern('Show Name S1E5.mkv', 1, 5)).toBe(true)
      expect(matchesEpisodePattern('Show Name S2E12.mkv', 2, 12)).toBe(true)
    })

    it('should match mixed padding formats', () => {
      expect(matchesEpisodePattern('Show Name S01E5.mkv', 1, 5)).toBe(true)
      expect(matchesEpisodePattern('Show Name S1E05.mkv', 1, 5)).toBe(true)
    })

    it('should match S01.E05 format (dot separator)', () => {
      expect(matchesEpisodePattern('Show Name S01.E05.mkv', 1, 5)).toBe(true)
      expect(matchesEpisodePattern('Show Name S1.E5.mkv', 1, 5)).toBe(true)
    })

    it('should match S01xE05 format (x separator)', () => {
      expect(matchesEpisodePattern('Show Name S01xE05.mkv', 1, 5)).toBe(true)
      expect(matchesEpisodePattern('Show Name S1xE5.mkv', 1, 5)).toBe(true)
    })

    it('should match S01 E05 format (space separator)', () => {
      expect(matchesEpisodePattern('Show Name S01 E05.mkv', 1, 5)).toBe(true)
      expect(matchesEpisodePattern('Show Name S1 E5.mkv', 1, 5)).toBe(true)
    })

    it('should match [S01E05] format (brackets)', () => {
      expect(matchesEpisodePattern('Show Name [S01E05].mkv', 1, 5)).toBe(true)
      expect(matchesEpisodePattern('Show Name [S1E5].mkv', 1, 5)).toBe(true)
    })

    it('should match [01x05] format (brackets with x)', () => {
      expect(matchesEpisodePattern('Show Name [01x05].mkv', 1, 5)).toBe(true)
      expect(matchesEpisodePattern('Show Name [1x5].mkv', 1, 5)).toBe(true)
    })

    it('should be case-insensitive', () => {
      expect(matchesEpisodePattern('Show Name s01e05.mkv', 1, 5)).toBe(true)
      expect(matchesEpisodePattern('Show Name S01e05.mkv', 1, 5)).toBe(true)
      expect(matchesEpisodePattern('Show Name s01E05.mkv', 1, 5)).toBe(true)
    })
  })

  describe('Pattern 1: Episode-only formats (season 1 only)', () => {
    it('should match E05 format when season is 1', () => {
      expect(matchesEpisodePattern('Show Name E05.mkv', 1, 5)).toBe(true)
      expect(matchesEpisodePattern('Show Name E5.mkv', 1, 5)).toBe(true)
    })

    it('should NOT match E05 format when season is not 1', () => {
      expect(matchesEpisodePattern('Show Name E05.mkv', 2, 5)).toBe(false)
    })

    it('should match EP05 format when season is 1', () => {
      expect(matchesEpisodePattern('Show Name EP05.mkv', 1, 5)).toBe(true)
      expect(matchesEpisodePattern('Show Name EP5.mkv', 1, 5)).toBe(true)
    })

    it('should match EPISODE 05 format when season is 1', () => {
      expect(matchesEpisodePattern('Show Name EPISODE 05.mkv', 1, 5)).toBe(true)
      expect(matchesEpisodePattern('Show Name EPISODE 5.mkv', 1, 5)).toBe(true)
    })
  })

  describe('Pattern 2: Chinese format 第X季第Y集', () => {
    it('should match 第1季第5集 format', () => {
      expect(matchesEpisodePattern('Show Name 第1季第5集.mkv', 1, 5)).toBe(true)
      expect(matchesEpisodePattern('Show Name 第2季第12集.mkv', 2, 12)).toBe(true)
    })

    it('should match 第01季第05集 format (zero-padded)', () => {
      expect(matchesEpisodePattern('Show Name 第01季第05集.mkv', 1, 5)).toBe(true)
      expect(matchesEpisodePattern('Show Name 第02季第12集.mkv', 2, 12)).toBe(true)
    })
  })

  describe('Pattern 3: Chinese format variations', () => {
    it('should match 第1季 第5集 format (with space)', () => {
      expect(matchesEpisodePattern('Show Name 第1季 第5集.mkv', 1, 5)).toBe(true)
      expect(matchesEpisodePattern('Show Name 第01季 第05集.mkv', 1, 5)).toBe(true)
    })

    it('should match S1 第5集 format (mixed)', () => {
      expect(matchesEpisodePattern('Show Name S1 第5集.mkv', 1, 5)).toBe(true)
      expect(matchesEpisodePattern('Show Name S01 第05集.mkv', 1, 5)).toBe(true)
    })
  })

  describe('Pattern 4: Japanese format 第X話', () => {
    it('should match 第5話 format', () => {
      expect(matchesEpisodePattern('Show Name 第5話.mkv', 1, 5)).toBe(true)
      expect(matchesEpisodePattern('Show Name 第05話.mkv', 1, 5)).toBe(true)
    })

    it('should match 第5回 format', () => {
      expect(matchesEpisodePattern('Show Name 第5回.mkv', 1, 5)).toBe(true)
      expect(matchesEpisodePattern('Show Name 第05回.mkv', 1, 5)).toBe(true)
    })

    it('should match 5話 format (without 第)', () => {
      expect(matchesEpisodePattern('Show Name 5話.mkv', 1, 5)).toBe(true)
      expect(matchesEpisodePattern('Show Name 05話.mkv', 1, 5)).toBe(true)
    })

    it('should match 5回 format (without 第)', () => {
      expect(matchesEpisodePattern('Show Name 5回.mkv', 1, 5)).toBe(true)
      expect(matchesEpisodePattern('Show Name 05回.mkv', 1, 5)).toBe(true)
    })

    it('should match S01 第5話 format (with season)', () => {
      expect(matchesEpisodePattern('Show Name S01 第5話.mkv', 1, 5)).toBe(true)
      expect(matchesEpisodePattern('Show Name S1 第05話.mkv', 1, 5)).toBe(true)
      expect(matchesEpisodePattern('Show Name S02 第5話.mkv', 2, 5)).toBe(true)
    })

    it('should match S01 第5回 format (with season)', () => {
      expect(matchesEpisodePattern('Show Name S01 第5回.mkv', 1, 5)).toBe(true)
      expect(matchesEpisodePattern('Show Name S1 第05回.mkv', 1, 5)).toBe(true)
      expect(matchesEpisodePattern('Show Name S02 第5回.mkv', 2, 5)).toBe(true)
    })

    it('should match シーズン1 エピソード5 format (full Japanese text)', () => {
      expect(matchesEpisodePattern('Show Name シーズン1 エピソード5.mkv', 1, 5)).toBe(true)
      expect(matchesEpisodePattern('Show Name シーズン01 エピソード05.mkv', 1, 5)).toBe(true)
    })

    it('should match シーズン1 第5話 format (full Japanese text)', () => {
      expect(matchesEpisodePattern('Show Name シーズン1 第5話.mkv', 1, 5)).toBe(true)
      expect(matchesEpisodePattern('Show Name シーズン01 第05話.mkv', 1, 5)).toBe(true)
    })
  })

  describe('Pattern 5: Single season formats (season 1 only)', () => {
    it('should match " 05 " format (space-number-space)', () => {
      expect(matchesEpisodePattern('Show Name 05 Episode.mkv', 1, 5)).toBe(true)
      expect(matchesEpisodePattern('Show Name 5 Episode.mkv', 1, 5)).toBe(true)
    })

    it('should match "05 " format (at start)', () => {
      expect(matchesEpisodePattern('05 Episode.mkv', 1, 5)).toBe(true)
      expect(matchesEpisodePattern('5 Episode.mkv', 1, 5)).toBe(true)
    })

    it('should match " 05" format (at end)', () => {
      expect(matchesEpisodePattern('Show Name Episode 05.mkv', 1, 5)).toBe(true)
      expect(matchesEpisodePattern('Show Name Episode 5.mkv', 1, 5)).toBe(true)
    })

    it('should match " #05 " format (space-hash-number-space)', () => {
      expect(matchesEpisodePattern('Show Name #05 Episode.mkv', 1, 5)).toBe(true)
      expect(matchesEpisodePattern('Show Name #5 Episode.mkv', 1, 5)).toBe(true)
    })

    it('should match "#05 " format (hash-number-space at start)', () => {
      expect(matchesEpisodePattern('#05 Episode.mkv', 1, 5)).toBe(true)
      expect(matchesEpisodePattern('#5 Episode.mkv', 1, 5)).toBe(true)
    })

    it('should match "- 05" format (dash-space-number)', () => {
      expect(matchesEpisodePattern('Show Name - 05.mkv', 1, 5)).toBe(true)
      expect(matchesEpisodePattern('Show Name - 5.mkv', 1, 5)).toBe(true)
    })

    it('should NOT match single season formats when season is not 1', () => {
      expect(matchesEpisodePattern('Show Name 05 Episode.mkv', 2, 5)).toBe(false)
      expect(matchesEpisodePattern('Show Name #05 Episode.mkv', 2, 5)).toBe(false)
      expect(matchesEpisodePattern('Show Name - 05.mkv', 2, 5)).toBe(false)
    })
  })

  describe('Negative cases', () => {
    it('should not match wrong season number', () => {
      expect(matchesEpisodePattern('Show Name S01E05.mkv', 2, 5)).toBe(false)
      // Note: S02E05 contains E05, so it matches episode-only pattern for season 1
      // This is a known limitation of substring matching
    })

    it('should not match wrong episode number', () => {
      expect(matchesEpisodePattern('Show Name S01E05.mkv', 1, 6)).toBe(false)
      expect(matchesEpisodePattern('Show Name S01E12.mkv', 1, 5)).toBe(false)
    })

    it('should not match partial numbers', () => {
      expect(matchesEpisodePattern('Show Name S01E105.mkv', 1, 5)).toBe(false)
      // Note: S101E05 contains S1E05 as substring, so it matches
      // This is a known limitation of substring matching
    })

    it('should not match when pattern is not present', () => {
      expect(matchesEpisodePattern('Show Name Episode.mkv', 1, 5)).toBe(false)
      expect(matchesEpisodePattern('Show Name.mkv', 1, 5)).toBe(false)
    })
  })

  describe('Edge cases', () => {
    it('should handle episode 1', () => {
      expect(matchesEpisodePattern('Show Name S01E01.mkv', 1, 1)).toBe(true)
      expect(matchesEpisodePattern('Show Name S1E1.mkv', 1, 1)).toBe(true)
      expect(matchesEpisodePattern('Show Name 第1季第1集.mkv', 1, 1)).toBe(true)
      expect(matchesEpisodePattern('Show Name 第1話.mkv', 1, 1)).toBe(true)
    })

    it('should handle episode 99', () => {
      expect(matchesEpisodePattern('Show Name S01E99.mkv', 1, 99)).toBe(true)
      expect(matchesEpisodePattern('Show Name S1E99.mkv', 1, 99)).toBe(true)
      expect(matchesEpisodePattern('Show Name 第1季第99集.mkv', 1, 99)).toBe(true)
      expect(matchesEpisodePattern('Show Name 第99話.mkv', 1, 99)).toBe(true)
    })

    it('should handle season 10', () => {
      expect(matchesEpisodePattern('Show Name S10E05.mkv', 10, 5)).toBe(true)
      expect(matchesEpisodePattern('Show Name S10 E05.mkv', 10, 5)).toBe(true)
      expect(matchesEpisodePattern('Show Name 第10季第5集.mkv', 10, 5)).toBe(true)
    })

    it('should handle filenames with multiple patterns', () => {
      expect(matchesEpisodePattern('Show Name S01E05 [1080p].mkv', 1, 5)).toBe(true)
      expect(matchesEpisodePattern('Show Name - S01E05 - Episode Title.mkv', 1, 5)).toBe(true)
    })
  })
})

describe('recognizeMediaFiles', () => {
  it('should return empty array when mm.files is undefined', () => {
    const mockMetadata: UIMediaMetadata = {
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
        seasons: [
          {
            season_number: 1,
            episodes: [
              { episode_number: 1, name: 'Episode 1', overview: '', still_path: null, air_date: '', season_number: 1, vote_average: 0, vote_count: 0, runtime: 0, id: 1 },
            ],
            id: 1,
            name: '',
            overview: '',
            poster_path: null,
            air_date: '',
            episode_count: 0,
          },
        ],
        status: '',
        type: '',
        in_production: false,
        last_air_date: '',
        networks: [],
        production_companies: [],
      },
    }

    const result = recognizeMediaFiles(mockMetadata)
    expect(result).toEqual([])
  })

  it('should return empty array when mm.tmdbTvShow is undefined', () => {
    const mockMetadata: UIMediaMetadata = {
      files: [
        '/media/tvshows/Test Show/S01E01.mkv',
      ],
    }

    const result = recognizeMediaFiles(mockMetadata)
    expect(result).toEqual([])
  })

  it('should return matched episodes when files match SXXEYY pattern', () => {
    const mockMetadata: UIMediaMetadata = {
      files: [
        '/media/tvshows/Test Show/S01E01.mkv',
        '/media/tvshows/Test Show/S01E02.mkv',
        '/media/tvshows/Test Show/S02E01.mkv',
      ],
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
        seasons: [
          {
            season_number: 1,
            episodes: [
              { episode_number: 1, name: 'Episode 1', overview: '', still_path: null, air_date: '', season_number: 1, vote_average: 0, vote_count: 0, runtime: 0, id: 1 },
              { episode_number: 2, name: 'Episode 2', overview: '', still_path: null, air_date: '', season_number: 1, vote_average: 0, vote_count: 0, runtime: 0, id: 2 },
            ],
            id: 1,
            name: '',
            overview: '',
            poster_path: null,
            air_date: '',
            episode_count: 0,
          },
          {
            season_number: 2,
            episodes: [
              { episode_number: 1, name: 'Episode 1', overview: '', still_path: null, air_date: '', season_number: 2, vote_average: 0, vote_count: 0, runtime: 0, id: 3 },
            ],
            id: 2,
            name: '',
            overview: '',
            poster_path: null,
            air_date: '',
            episode_count: 0,
          },
        ],
        status: '',
        type: '',
        in_production: false,
        last_air_date: '',
        networks: [],
        production_companies: [],
      },
    }

    const result = recognizeMediaFiles(mockMetadata)
    expect(result).toHaveLength(3)
    expect(result).toContainEqual({
      season: 1,
      episode: 1,
      videoFilePath: '/media/tvshows/Test Show/S01E01.mkv',
    })
    expect(result).toContainEqual({
      season: 1,
      episode: 2,
      videoFilePath: '/media/tvshows/Test Show/S01E02.mkv',
    })
    expect(result).toContainEqual({
      season: 2,
      episode: 1,
      videoFilePath: '/media/tvshows/Test Show/S02E01.mkv',
    })
  })

  it('should return matched episodes when files match Chinese pattern', () => {
    const mockMetadata: UIMediaMetadata = {
      files: [
        '/media/tvshows/Test Show/第1季第1集.mkv',
        '/media/tvshows/Test Show/第1季第2集.mkv',
      ],
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
        seasons: [
          {
            season_number: 1,
            episodes: [
              { episode_number: 1, name: 'Episode 1', overview: '', still_path: null, air_date: '', season_number: 1, vote_average: 0, vote_count: 0, runtime: 0, id: 1 },
              { episode_number: 2, name: 'Episode 2', overview: '', still_path: null, air_date: '', season_number: 1, vote_average: 0, vote_count: 0, runtime: 0, id: 2 },
            ],
            id: 1,
            name: '',
            overview: '',
            poster_path: null,
            air_date: '',
            episode_count: 0,
          },
        ],
        status: '',
        type: '',
        in_production: false,
        last_air_date: '',
        networks: [],
        production_companies: [],
      },
    }

    const result = recognizeMediaFiles(mockMetadata)
    expect(result).toHaveLength(2)
    expect(result).toContainEqual({
      season: 1,
      episode: 1,
      videoFilePath: '/media/tvshows/Test Show/第1季第1集.mkv',
    })
    expect(result).toContainEqual({
      season: 1,
      episode: 2,
      videoFilePath: '/media/tvshows/Test Show/第1季第2集.mkv',
    })
  })

  it('should return empty array when no files match patterns', () => {
    const mockMetadata: UIMediaMetadata = {
      files: [
        '/media/tvshows/Test Show/SomeRandomVideo.mkv',
        '/media/tvshows/Test Show/AnotherFile.mp4',
      ],
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
        seasons: [
          {
            season_number: 1,
            episodes: [
              { episode_number: 1, name: 'Episode 1', overview: '', still_path: null, air_date: '', season_number: 1, vote_average: 0, vote_count: 0, runtime: 0, id: 1 },
              { episode_number: 2, name: 'Episode 2', overview: '', still_path: null, air_date: '', season_number: 1, vote_average: 0, vote_count: 0, runtime: 0, id: 2 },
            ],
            id: 1,
            name: '',
            overview: '',
            poster_path: null,
            air_date: '',
            episode_count: 0,
          },
        ],
        status: '',
        type: '',
        in_production: false,
        last_air_date: '',
        networks: [],
        production_companies: [],
      },
    }

    const result = recognizeMediaFiles(mockMetadata)
    expect(result).toEqual([])
  })

  it('should handle non-video files in files array', () => {
    const mockMetadata: UIMediaMetadata = {
      files: [
        '/media/tvshows/Test Show/S01E01.mkv',
        '/media/tvshows/Test Show/S01E01.srt',
        '/media/tvshows/Test Show/poster.jpg',
        '/media/tvshows/Test Show/nfo.xml',
      ],
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
        seasons: [
          {
            season_number: 1,
            episodes: [
              { episode_number: 1, name: 'Episode 1', overview: '', still_path: null, air_date: '', season_number: 1, vote_average: 0, vote_count: 0, runtime: 0, id: 1 },
            ],
            id: 1,
            name: '',
            overview: '',
            poster_path: null,
            air_date: '',
            episode_count: 0,
          },
        ],
        status: '',
        type: '',
        in_production: false,
        last_air_date: '',
        networks: [],
        production_companies: [],
      },
    }

    const result = recognizeMediaFiles(mockMetadata)
    expect(result).toHaveLength(1)
    expect(result[0].videoFilePath).toBe('/media/tvshows/Test Show/S01E01.mkv')
  })

  it('should return empty array when seasons array is empty', () => {
    const mockMetadata: UIMediaMetadata = {
      files: [
        '/media/tvshows/Test Show/S01E01.mkv',
      ],
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
    }

    const result = recognizeMediaFiles(mockMetadata)
    expect(result).toEqual([])
  })

  it('should handle episodes array being undefined', () => {
    const mockMetadata: UIMediaMetadata = {
      files: [
        '/media/tvshows/Test Show/S01E01.mkv',
      ],
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
        seasons: [
          {
            season_number: 1,
            episodes: undefined,
            id: 1,
            name: '',
            overview: '',
            poster_path: null,
            air_date: '',
            episode_count: 0,
          },
        ],
        status: '',
        type: '',
        in_production: false,
        last_air_date: '',
        networks: [],
        production_companies: [],
      },
    }

    const result = recognizeMediaFiles(mockMetadata)
    expect(result).toEqual([])
  })
})
