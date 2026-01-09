import { describe, it, expect } from 'vitest'
import { _buildMappingFromSeasonModels } from './TvShowPanelUtils'
import type { SeasonModel } from './TvShowPanel'
import type { FileProps } from '@/lib/types'

describe('_buildMappingFromSeasonModels', () => {
  it('should return empty array when given empty seasons array', () => {
    const seasons: SeasonModel[] = []
    
    const result = _buildMappingFromSeasonModels(seasons)
    
    expect(result).toEqual([])
  })

  it('should return empty array when seasons have no episodes', () => {
    const seasons: SeasonModel[] = [
      {
        season: {
          id: 1,
          name: 'Season 1',
          overview: '',
          poster_path: null,
          season_number: 1,
          air_date: '2024-01-01',
          episode_count: 0,
          episodes: [],
        },
        episodes: [],
      },
    ]
    
    const result = _buildMappingFromSeasonModels(seasons)
    
    expect(result).toEqual([])
  })

  it('should return empty array when episodes have no video files', () => {
    const seasons: SeasonModel[] = [
      {
        season: {
          id: 1,
          name: 'Season 1',
          overview: '',
          poster_path: null,
          season_number: 1,
          air_date: '2024-01-01',
          episode_count: 1,
          episodes: [
            {
              id: 101,
              name: 'Episode 1',
              overview: '',
              still_path: null,
              air_date: '2024-01-01',
              episode_number: 1,
              season_number: 1,
              vote_average: 8.5,
              vote_count: 100,
              runtime: 42,
            },
          ],
        },
        episodes: [
          {
            episode: {
              id: 101,
              name: 'Episode 1',
              overview: '',
              still_path: null,
              air_date: '2024-01-01',
              episode_number: 1,
              season_number: 1,
              vote_average: 8.5,
              vote_count: 100,
              runtime: 42,
            },
            files: [
              {
                type: 'subtitle',
                path: '/path/to/subtitle.srt',
              } as FileProps,
            ],
          },
        ],
      },
    ]
    
    const result = _buildMappingFromSeasonModels(seasons)
    
    expect(result).toEqual([])
  })

  it('should build mapping for single season with single episode', () => {
    const seasons: SeasonModel[] = [
      {
        season: {
          id: 1,
          name: 'Season 1',
          overview: '',
          poster_path: null,
          season_number: 1,
          air_date: '2024-01-01',
          episode_count: 1,
          episodes: [
            {
              id: 101,
              name: 'Episode 1',
              overview: '',
              still_path: null,
              air_date: '2024-01-01',
              episode_number: 1,
              season_number: 1,
              vote_average: 8.5,
              vote_count: 100,
              runtime: 42,
            },
          ],
        },
        episodes: [
          {
            episode: {
              id: 101,
              name: 'Episode 1',
              overview: '',
              still_path: null,
              air_date: '2024-01-01',
              episode_number: 1,
              season_number: 1,
              vote_average: 8.5,
              vote_count: 100,
              runtime: 42,
            },
            files: [
              {
                type: 'video',
                path: '/path/to/episode1.mp4',
              } as FileProps,
            ],
          },
        ],
      },
    ]
    
    const result = _buildMappingFromSeasonModels(seasons)
    
    expect(result).toEqual([
      {
        seasonNumber: 1,
        episodeNumber: 1,
        videoFilePath: '/path/to/episode1.mp4',
      },
    ])
  })

  it('should build mapping for single season with multiple episodes', () => {
    const seasons: SeasonModel[] = [
      {
        season: {
          id: 1,
          name: 'Season 1',
          overview: '',
          poster_path: null,
          season_number: 1,
          air_date: '2024-01-01',
          episode_count: 2,
          episodes: [
            {
              id: 101,
              name: 'Episode 1',
              overview: '',
              still_path: null,
              air_date: '2024-01-01',
              episode_number: 1,
              season_number: 1,
              vote_average: 8.5,
              vote_count: 100,
              runtime: 42,
            },
            {
              id: 102,
              name: 'Episode 2',
              overview: '',
              still_path: null,
              air_date: '2024-01-08',
              episode_number: 2,
              season_number: 1,
              vote_average: 8.3,
              vote_count: 95,
              runtime: 42,
            },
          ],
        },
        episodes: [
          {
            episode: {
              id: 101,
              name: 'Episode 1',
              overview: '',
              still_path: null,
              air_date: '2024-01-01',
              episode_number: 1,
              season_number: 1,
              vote_average: 8.5,
              vote_count: 100,
              runtime: 42,
            },
            files: [
              {
                type: 'video',
                path: '/path/to/episode1.mp4',
              } as FileProps,
            ],
          },
          {
            episode: {
              id: 102,
              name: 'Episode 2',
              overview: '',
              still_path: null,
              air_date: '2024-01-08',
              episode_number: 2,
              season_number: 1,
              vote_average: 8.3,
              vote_count: 95,
              runtime: 42,
            },
            files: [
              {
                type: 'video',
                path: '/path/to/episode2.mp4',
              } as FileProps,
            ],
          },
        ],
      },
    ]
    
    const result = _buildMappingFromSeasonModels(seasons)
    
    expect(result).toEqual([
      {
        seasonNumber: 1,
        episodeNumber: 1,
        videoFilePath: '/path/to/episode1.mp4',
      },
      {
        seasonNumber: 1,
        episodeNumber: 2,
        videoFilePath: '/path/to/episode2.mp4',
      },
    ])
  })

  it('should build mapping for multiple seasons with multiple episodes', () => {
    const seasons: SeasonModel[] = [
      {
        season: {
          id: 1,
          name: 'Season 1',
          overview: '',
          poster_path: null,
          season_number: 1,
          air_date: '2024-01-01',
          episode_count: 1,
          episodes: [
            {
              id: 101,
              name: 'Episode 1',
              overview: '',
              still_path: null,
              air_date: '2024-01-01',
              episode_number: 1,
              season_number: 1,
              vote_average: 8.5,
              vote_count: 100,
              runtime: 42,
            },
          ],
        },
        episodes: [
          {
            episode: {
              id: 101,
              name: 'Episode 1',
              overview: '',
              still_path: null,
              air_date: '2024-01-01',
              episode_number: 1,
              season_number: 1,
              vote_average: 8.5,
              vote_count: 100,
              runtime: 42,
            },
            files: [
              {
                type: 'video',
                path: '/path/to/s01e01.mp4',
              } as FileProps,
            ],
          },
        ],
      },
      {
        season: {
          id: 2,
          name: 'Season 2',
          overview: '',
          poster_path: null,
          season_number: 2,
          air_date: '2024-07-01',
          episode_count: 2,
          episodes: [
            {
              id: 201,
              name: 'Episode 1',
              overview: '',
              still_path: null,
              air_date: '2024-07-01',
              episode_number: 1,
              season_number: 2,
              vote_average: 9.0,
              vote_count: 120,
              runtime: 45,
            },
            {
              id: 202,
              name: 'Episode 2',
              overview: '',
              still_path: null,
              air_date: '2024-07-08',
              episode_number: 2,
              season_number: 2,
              vote_average: 8.8,
              vote_count: 115,
              runtime: 45,
            },
          ],
        },
        episodes: [
          {
            episode: {
              id: 201,
              name: 'Episode 1',
              overview: '',
              still_path: null,
              air_date: '2024-07-01',
              episode_number: 1,
              season_number: 2,
              vote_average: 9.0,
              vote_count: 120,
              runtime: 45,
            },
            files: [
              {
                type: 'video',
                path: '/path/to/s02e01.mp4',
              } as FileProps,
            ],
          },
          {
            episode: {
              id: 202,
              name: 'Episode 2',
              overview: '',
              still_path: null,
              air_date: '2024-07-08',
              episode_number: 2,
              season_number: 2,
              vote_average: 8.8,
              vote_count: 115,
              runtime: 45,
            },
            files: [
              {
                type: 'video',
                path: '/path/to/s02e02.mp4',
              } as FileProps,
            ],
          },
        ],
      },
    ]
    
    const result = _buildMappingFromSeasonModels(seasons)
    
    expect(result).toEqual([
      {
        seasonNumber: 1,
        episodeNumber: 1,
        videoFilePath: '/path/to/s01e01.mp4',
      },
      {
        seasonNumber: 2,
        episodeNumber: 1,
        videoFilePath: '/path/to/s02e01.mp4',
      },
      {
        seasonNumber: 2,
        episodeNumber: 2,
        videoFilePath: '/path/to/s02e02.mp4',
      },
    ])
  })

  it('should only include episodes with video files when episodes have multiple file types', () => {
    const seasons: SeasonModel[] = [
      {
        season: {
          id: 1,
          name: 'Season 1',
          overview: '',
          poster_path: null,
          season_number: 1,
          air_date: '2024-01-01',
          episode_count: 1,
          episodes: [
            {
              id: 101,
              name: 'Episode 1',
              overview: '',
              still_path: null,
              air_date: '2024-01-01',
              episode_number: 1,
              season_number: 1,
              vote_average: 8.5,
              vote_count: 100,
              runtime: 42,
            },
          ],
        },
        episodes: [
          {
            episode: {
              id: 101,
              name: 'Episode 1',
              overview: '',
              still_path: null,
              air_date: '2024-01-01',
              episode_number: 1,
              season_number: 1,
              vote_average: 8.5,
              vote_count: 100,
              runtime: 42,
            },
            files: [
              {
                type: 'video',
                path: '/path/to/episode1.mp4',
              } as FileProps,
              {
                type: 'subtitle',
                path: '/path/to/episode1.srt',
              } as FileProps,
              {
                type: 'audio',
                path: '/path/to/episode1.mka',
              } as FileProps,
            ],
          },
        ],
      },
    ]
    
    const result = _buildMappingFromSeasonModels(seasons)
    
    expect(result).toEqual([
      {
        seasonNumber: 1,
        episodeNumber: 1,
        videoFilePath: '/path/to/episode1.mp4',
      },
    ])
  })

  it('should skip episodes without video files when mixed with episodes that have video files', () => {
    const seasons: SeasonModel[] = [
      {
        season: {
          id: 1,
          name: 'Season 1',
          overview: '',
          poster_path: null,
          season_number: 1,
          air_date: '2024-01-01',
          episode_count: 2,
          episodes: [
            {
              id: 101,
              name: 'Episode 1',
              overview: '',
              still_path: null,
              air_date: '2024-01-01',
              episode_number: 1,
              season_number: 1,
              vote_average: 8.5,
              vote_count: 100,
              runtime: 42,
            },
            {
              id: 102,
              name: 'Episode 2',
              overview: '',
              still_path: null,
              air_date: '2024-01-08',
              episode_number: 2,
              season_number: 1,
              vote_average: 8.3,
              vote_count: 95,
              runtime: 42,
            },
          ],
        },
        episodes: [
          {
            episode: {
              id: 101,
              name: 'Episode 1',
              overview: '',
              still_path: null,
              air_date: '2024-01-01',
              episode_number: 1,
              season_number: 1,
              vote_average: 8.5,
              vote_count: 100,
              runtime: 42,
            },
            files: [
              {
                type: 'video',
                path: '/path/to/episode1.mp4',
              } as FileProps,
            ],
          },
          {
            episode: {
              id: 102,
              name: 'Episode 2',
              overview: '',
              still_path: null,
              air_date: '2024-01-08',
              episode_number: 2,
              season_number: 1,
              vote_average: 8.3,
              vote_count: 95,
              runtime: 42,
            },
            files: [
              {
                type: 'subtitle',
                path: '/path/to/episode2.srt',
              } as FileProps,
            ],
          },
        ],
      },
    ]
    
    const result = _buildMappingFromSeasonModels(seasons)
    
    expect(result).toEqual([
      {
        seasonNumber: 1,
        episodeNumber: 1,
        videoFilePath: '/path/to/episode1.mp4',
      },
    ])
  })
})
