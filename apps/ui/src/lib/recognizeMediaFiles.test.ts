import { describe, it, expect } from 'vitest'
import type { UIMediaMetadata } from '@/types/UIMediaMetadata'
import { recognizeMediaFiles } from './recognizeMediaFiles'

describe('recognizeMediaFiles', () => {
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
  
      const result = recognizeMediaFiles(mockMetadata)
      expect(result).toEqual([])
    })
  
    it('should return empty array when mm.tmdbTvShow is undefined', () => {
      const mockMetadata: UIMediaMetadata = {
        status: 'ok',
        files: [
          '/media/tvshows/Test Show/S01E01.mkv',
        ],
      }
  
      const result = recognizeMediaFiles(mockMetadata)
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
  
      const result = recognizeMediaFiles(mockMetadata)
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
  
      const result = recognizeMediaFiles(mockMetadata)
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
  
      const result = recognizeMediaFiles(mockMetadata)
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
  
      const result = recognizeMediaFiles(mockMetadata)
      expect(result).toEqual([])
    })
  })