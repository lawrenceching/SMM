import { describe, it, expect, vi } from 'vitest'
import type { UIMediaMetadata } from '@/types/UIMediaMetadata'
import { collectRecognizedEpisodes, recognizeTvShowMediaFiles } from './recognizeMediaFiles'

describe('collectRecognizedEpisodes', () => {
  it('returns empty array when mm.files is undefined', () => {
    const mm: UIMediaMetadata = {
      status: 'ok',
      tmdbTvShow: {
        id: 1,
        name: 'Show',
        seasons: [{ id: 1, season_number: 1, episodes: [{ episode_number: 1, season_number: 1 } as any] } as any],
      } as any,
    }
    const lookup = vi.fn(() => '/path/video.mkv')
    expect(collectRecognizedEpisodes(mm, lookup)).toEqual([])
    expect(lookup).not.toHaveBeenCalled()
  })

  it('returns empty array when mm.tmdbTvShow is undefined', () => {
    const mm: UIMediaMetadata = {
      status: 'ok',
      files: ['/path/S01E01.mkv'],
    }
    const lookup = vi.fn(() => '/path/S01E01.mkv')
    expect(collectRecognizedEpisodes(mm, lookup)).toEqual([])
    expect(lookup).not.toHaveBeenCalled()
  })

  it('returns collected episodes when lookup returns paths', () => {
    const mm: UIMediaMetadata = {
      status: 'ok',
      files: ['/media/S01E01.mkv', '/media/S01E02.mkv'],
      tmdbTvShow: {
        id: 1,
        name: 'Show',
        seasons: [
          {
            id: 1,
            season_number: 1,
            episodes: [
              { episode_number: 1, season_number: 1 } as any,
              { episode_number: 2, season_number: 1 } as any,
            ],
          } as any,
        ],
      } as any,
    }
    const lookup = vi.fn((_files: string[], sn: number, en: number) => {
      if (sn === 1 && en === 1) return '/media/S01E01.mkv'
      if (sn === 1 && en === 2) return '/media/S01E02.mkv'
      return null
    })
    const result = collectRecognizedEpisodes(mm, lookup)
    expect(result).toHaveLength(2)
    expect(result).toContainEqual({ season: 1, episode: 1, videoFilePath: '/media/S01E01.mkv' })
    expect(result).toContainEqual({ season: 1, episode: 2, videoFilePath: '/media/S01E02.mkv' })
    expect(lookup).toHaveBeenCalledWith(mm.files, 1, 1)
    expect(lookup).toHaveBeenCalledWith(mm.files, 1, 2)
  })

  it('deduplicates by videoFilePath so the same file is not returned twice', () => {
    const mm: UIMediaMetadata = {
      status: 'ok',
      files: ['/media/S01E01.mkv'],
      tmdbTvShow: {
        id: 1,
        name: 'Show',
        seasons: [
          {
            id: 1,
            season_number: 1,
            episodes: [
              { episode_number: 1, season_number: 1 } as any,
              { episode_number: 2, season_number: 1 } as any,
            ],
          } as any,
        ],
      } as any,
    }
    const lookup = vi.fn((_files: string[], sn: number, en: number) => {
      // Both episodes resolve to the same underlying file
      if (sn === 1 && (en === 1 || en === 2)) return '/media/S01E01.mkv'
      return null
    })
    const result = collectRecognizedEpisodes(mm, lookup)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      season: 1,
      episode: 1,
      videoFilePath: '/media/S01E01.mkv',
    })
    // lookup is still called for both episodes; dedup happens on collection
    expect(lookup).toHaveBeenCalledWith(mm.files, 1, 1)
    expect(lookup).toHaveBeenCalledWith(mm.files, 1, 2)
  })

  it('skips episodes when lookup returns null', () => {
    const mm: UIMediaMetadata = {
      status: 'ok',
      files: [],
      tmdbTvShow: {
        id: 1,
        name: 'Show',
        seasons: [{ id: 1, season_number: 1, episodes: [{ episode_number: 1, season_number: 1 } as any] } as any],
      } as any,
    }
    const lookup = vi.fn(() => null)
    expect(collectRecognizedEpisodes(mm, lookup)).toEqual([])
    expect(lookup).toHaveBeenCalledWith([], 1, 1)
  })

  it('handles episodes array being undefined', () => {
    const mm: UIMediaMetadata = {
      status: 'ok',
      files: ['/media/S01E01.mkv'],
      tmdbTvShow: {
        id: 1,
        name: 'Show',
        seasons: [{ id: 1, season_number: 1, episodes: undefined } as any],
      } as any,
    }
    const lookup = vi.fn(() => '/media/S01E01.mkv')
    expect(collectRecognizedEpisodes(mm, lookup)).toEqual([])
    expect(lookup).not.toHaveBeenCalled()
  })
})

describe('recognizeTvShowMediaFiles', () => {
    it('should return empty array when mm.files is undefined', () => {
      const mockMetadata: UIMediaMetadata = {
        status: 'ok',
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
  
      const result = recognizeTvShowMediaFiles(mockMetadata)
      expect(result).toEqual([])
    })
  
    it('should return empty array when mm.tmdbTvShow is undefined', () => {
      const mockMetadata: UIMediaMetadata = {
        status: 'ok',
        files: [
          '/media/tvshows/Test Show/S01E01.mkv',
        ],
      }
  
      const result = recognizeTvShowMediaFiles(mockMetadata)
      expect(result).toEqual([])
    })
  
    it('should return matched episodes when files match SXXEYY pattern', () => {
      const mockMetadata: UIMediaMetadata = {
        status: 'ok',
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
  
      const result = recognizeTvShowMediaFiles(mockMetadata)
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
        status: 'ok',
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
  
      const result = recognizeTvShowMediaFiles(mockMetadata)
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
        status: 'ok',
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
  
      const result = recognizeTvShowMediaFiles(mockMetadata)
      expect(result).toEqual([])
    })
  
    it('should handle non-video files in files array', () => {
      const mockMetadata: UIMediaMetadata = {
        status: 'ok',
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
  
      const result = recognizeTvShowMediaFiles(mockMetadata)
      expect(result).toHaveLength(1)
      expect(result[0].videoFilePath).toBe('/media/tvshows/Test Show/S01E01.mkv')
    })
  
    it('should return empty array when seasons array is empty', () => {
      const mockMetadata: UIMediaMetadata = {
        status: 'ok',
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
  
      const result = recognizeTvShowMediaFiles(mockMetadata)
      expect(result).toEqual([])
    })
  
    it('should handle episodes array being undefined', () => {
      const mockMetadata: UIMediaMetadata = {
        status: 'ok',
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
  
      const result = recognizeTvShowMediaFiles(mockMetadata)
      expect(result).toEqual([])
    })
  })