import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { _buildMappingFromSeasonModels, mapTagToFileType, newPath, buildFileProps, renameFiles, updateMediaFileMetadatas, recognizeEpisodes } from './TvShowPanelUtils'
import type { SeasonModel } from './TvShowPanel'
import type { FileProps } from '@/lib/types'
import type { MediaMetadata, MediaFileMetadata } from '@core/types'

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

describe('mapTagToFileType', () => {
  it('should return "video" when tag is "VID"', () => {
    expect(mapTagToFileType('VID')).toBe('video')
  })

  it('should return "subtitle" when tag is "SUB"', () => {
    expect(mapTagToFileType('SUB')).toBe('subtitle')
  })

  it('should return "audio" when tag is "AUD"', () => {
    expect(mapTagToFileType('AUD')).toBe('audio')
  })

  it('should return "nfo" when tag is "NFO"', () => {
    expect(mapTagToFileType('NFO')).toBe('nfo')
  })

  it('should return "poster" when tag is "POSTER"', () => {
    expect(mapTagToFileType('POSTER')).toBe('poster')
  })

  it('should return "file" when tag is empty string', () => {
    expect(mapTagToFileType('')).toBe('file')
  })

  it('should have correct return type', () => {
    const result = mapTagToFileType('VID')
    expect(typeof result).toBe('string')
    expect(['file', 'video', 'subtitle', 'audio', 'nfo', 'poster']).toContain(result)
  })
})

describe('newPath', () => {
  it('should calculate new path for subtitle file', () => {
    const mediaFolderPath = '/media/tvshow'
    const videoFilePath = '/media/tvshow/season1/episode1.mkv'
    const associatedFilePath = '/media/tvshow/season1/episode1.srt'
    
    const result = newPath(mediaFolderPath, videoFilePath, associatedFilePath)
    
    expect(result).toBe('/media/tvshow/season1/episode1.srt')
  })

  it('should calculate new path when video file extension changes', () => {
    const mediaFolderPath = '/media/tvshow'
    const videoFilePath = '/media/tvshow/season1/episode1_new.mkv'
    const associatedFilePath = '/media/tvshow/season1/episode1.srt'
    
    const result = newPath(mediaFolderPath, videoFilePath, associatedFilePath)
    
    expect(result).toBe('/media/tvshow/season1/episode1_new.srt')
  })

  it('should handle paths with different extensions', () => {
    const mediaFolderPath = '/media/tvshow'
    const videoFilePath = '/media/tvshow/season1/episode1_new.mkv'
    const associatedFilePath = '/media/tvshow/season1/episode1.en.srt'
    
    const result = newPath(mediaFolderPath, videoFilePath, associatedFilePath)
    
    // extname only returns the last extension, so .en.srt becomes .srt
    expect(result).toBe('/media/tvshow/season1/episode1_new.srt')
  })

  it('should handle nested directory structures', () => {
    const mediaFolderPath = '/media/tvshow'
    const videoFilePath = '/media/tvshow/Season 01/Episode 01_new.mkv'
    const associatedFilePath = '/media/tvshow/Season 01/Episode 01.en.srt'
    
    const result = newPath(mediaFolderPath, videoFilePath, associatedFilePath)
    
    // extname only returns the last extension, so .en.srt becomes .srt
    expect(result).toBe('/media/tvshow/Season 01/Episode 01_new.srt')
  })

  it('should handle POSIX path formats', () => {
    const mediaFolderPath = '/media/tvshow'
    const videoFilePath = '/media/tvshow/s01e01.mkv'
    const associatedFilePath = '/media/tvshow/s01e01.srt'
    
    const result = newPath(mediaFolderPath, videoFilePath, associatedFilePath)
    
    expect(result).toBe('/media/tvshow/s01e01.srt')
  })
})

describe('buildFileProps', () => {
  const createMockMediaMetadata = (overrides?: Partial<MediaMetadata>): MediaMetadata => ({
    mediaFolderPath: '/media/tvshow',
    mediaFiles: [
      {
        absolutePath: '/media/tvshow/season1/episode1.mkv',
        seasonNumber: 1,
        episodeNumber: 1,
      } as MediaFileMetadata,
    ],
    files: [
      '/media/tvshow/season1/episode1.mkv',
      '/media/tvshow/season1/episode1.en.srt',
      '/media/tvshow/season1/episode1.nfo',
    ],
    ...overrides,
  } as MediaMetadata)

  it('should build file props for valid media metadata', () => {
    const mm = createMockMediaMetadata()
    
    const result = buildFileProps(mm, 1, 1)
    
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toEqual({
      type: 'video',
      path: '/media/tvshow/season1/episode1.mkv',
    })
  })

  it('should throw error when mediaFolderPath is undefined', () => {
    const mm = createMockMediaMetadata({ mediaFolderPath: undefined })
    
    expect(() => buildFileProps(mm, 1, 1)).toThrow('Media folder path is undefined')
  })

  it('should return empty array when mediaFiles is undefined', () => {
    const mm = createMockMediaMetadata({ mediaFiles: undefined })
    
    const result = buildFileProps(mm, 1, 1)
    
    expect(result).toEqual([])
  })

  it('should return empty array when files is undefined', () => {
    const mm = createMockMediaMetadata({ files: undefined })
    
    const result = buildFileProps(mm, 1, 1)
    
    expect(result).toEqual([])
  })

  it('should return empty array when files is null', () => {
    const mm = createMockMediaMetadata({ files: null })
    
    const result = buildFileProps(mm, 1, 1)
    
    expect(result).toEqual([])
  })

  it('should return empty array when mediaFile for season/episode is not found', () => {
    const mm = createMockMediaMetadata()
    
    const result = buildFileProps(mm, 2, 5)
    
    expect(result).toEqual([])
  })

  it('should include associated files in the result', () => {
    const mm = createMockMediaMetadata()
    
    const result = buildFileProps(mm, 1, 1)
    
    // Should have video file plus associated files
    expect(result.length).toBeGreaterThan(1)
    expect(result.some(file => file.type === 'video')).toBe(true)
  })
})

describe('renameFiles', () => {
  it('should return empty array when no video file is found', () => {
    const mediaFolderPath = '/media/tvshow'
    const newVideoFilePath = '/media/tvshow/season1/episode1_new.mkv'
    const files: FileProps[] = [
      {
        type: 'subtitle',
        path: '/media/tvshow/season1/episode1.srt',
      },
    ]
    
    const result = renameFiles(mediaFolderPath, newVideoFilePath, files)
    
    expect(result).toEqual([])
  })

  it('should set newPath for video file correctly', () => {
    const mediaFolderPath = '/media/tvshow'
    const newVideoFilePath = '/media/tvshow/season1/episode1_new.mkv'
    const files: FileProps[] = [
      {
        type: 'video',
        path: '/media/tvshow/season1/episode1.mkv',
      },
    ]
    
    const result = renameFiles(mediaFolderPath, newVideoFilePath, files)
    
    expect(result.length).toBe(1)
    expect(result[0]).toEqual({
      type: 'video',
      path: '/media/tvshow/season1/episode1.mkv',
      newPath: newVideoFilePath,
    })
  })

  it('should set newPath for associated files correctly', () => {
    const mediaFolderPath = '/media/tvshow'
    const newVideoFilePath = '/media/tvshow/season1/episode1_new.mkv'
    const files: FileProps[] = [
      {
        type: 'video',
        path: '/media/tvshow/season1/episode1.mkv',
      },
      {
        type: 'subtitle',
        path: '/media/tvshow/season1/episode1.srt',
      },
      {
        type: 'audio',
        path: '/media/tvshow/season1/episode1.mka',
      },
    ]
    
    const result = renameFiles(mediaFolderPath, newVideoFilePath, files)
    
    expect(result.length).toBe(3)
    expect(result[0].type).toBe('video')
    expect(result[0].newPath).toBe(newVideoFilePath)
    expect(result[1].type).toBe('subtitle')
    expect(result[1].newPath).toBe('/media/tvshow/season1/episode1_new.srt')
    expect(result[2].type).toBe('audio')
    expect(result[2].newPath).toBe('/media/tvshow/season1/episode1_new.mka')
  })

  it('should handle files with no associated files', () => {
    const mediaFolderPath = '/media/tvshow'
    const newVideoFilePath = '/media/tvshow/season1/episode1_new.mkv'
    const files: FileProps[] = [
      {
        type: 'video',
        path: '/media/tvshow/season1/episode1.mkv',
      },
    ]
    
    const result = renameFiles(mediaFolderPath, newVideoFilePath, files)
    
    expect(result.length).toBe(1)
    expect(result[0].type).toBe('video')
    expect(result[0].newPath).toBe(newVideoFilePath)
  })

  it('should preserve file types correctly', () => {
    const mediaFolderPath = '/media/tvshow'
    const newVideoFilePath = '/media/tvshow/season1/episode1_new.mkv'
    const files: FileProps[] = [
      {
        type: 'video',
        path: '/media/tvshow/season1/episode1.mkv',
      },
      {
        type: 'subtitle',
        path: '/media/tvshow/season1/episode1.en.srt',
      },
      {
        type: 'nfo',
        path: '/media/tvshow/season1/episode1.nfo',
      },
    ]
    
    const result = renameFiles(mediaFolderPath, newVideoFilePath, files)
    
    expect(result[0].type).toBe('video')
    expect(result[1].type).toBe('subtitle')
    expect(result[2].type).toBe('nfo')
  })

  it('should handle paths with complex extensions', () => {
    const mediaFolderPath = '/media/tvshow'
    const newVideoFilePath = '/media/tvshow/season1/episode1_new.mkv'
    const files: FileProps[] = [
      {
        type: 'video',
        path: '/media/tvshow/season1/episode1.mkv',
      },
      {
        type: 'subtitle',
        path: '/media/tvshow/season1/episode1.en.forced.srt',
      },
    ]
    
    const result = renameFiles(mediaFolderPath, newVideoFilePath, files)
    
    // extname only returns the last extension, so .en.forced.srt becomes .srt
    expect(result[1].newPath).toBe('/media/tvshow/season1/episode1_new.srt')
  })

  it('should mutate input file newPath property before creating new object', () => {
    const mediaFolderPath = '/media/tvshow'
    const newVideoFilePath = '/media/tvshow/season1/episode1_new.mkv'
    const files: FileProps[] = [
      {
        type: 'video',
        path: '/media/tvshow/season1/episode1.mkv',
      },
      {
        type: 'subtitle',
        path: '/media/tvshow/season1/episode1.srt',
      },
    ]
    
    renameFiles(mediaFolderPath, newVideoFilePath, files)
    
    // The input file should have newPath set (mutation behavior)
    expect(files[1].newPath).toBe('/media/tvshow/season1/episode1_new.srt')
  })
})

describe('updateMediaFileMetadatas', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  it('should add new file when mediaFiles array is empty', () => {
    const mediaFiles: MediaFileMetadata[] = []
    const videoFilePath = '/media/tvshow/season1/episode1.mkv'
    const seasonNumber = 1
    const episodeNumber = 1
    
    const result = updateMediaFileMetadatas(mediaFiles, videoFilePath, seasonNumber, episodeNumber)
    
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      absolutePath: videoFilePath,
      seasonNumber: 1,
      episodeNumber: 1,
    })
    expect(consoleLogSpy).toHaveBeenCalledWith(`Add media file "${videoFilePath}" season ${seasonNumber} episode ${episodeNumber}`)
  })

  it('should add new file to existing mediaFiles array', () => {
    const mediaFiles: MediaFileMetadata[] = [
      {
        absolutePath: '/media/tvshow/season1/episode2.mkv',
        seasonNumber: 1,
        episodeNumber: 2,
      } as MediaFileMetadata,
    ]
    const videoFilePath = '/media/tvshow/season1/episode1.mkv'
    const seasonNumber = 1
    const episodeNumber = 1
    
    const result = updateMediaFileMetadatas(mediaFiles, videoFilePath, seasonNumber, episodeNumber)
    
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      absolutePath: '/media/tvshow/season1/episode2.mkv',
      seasonNumber: 1,
      episodeNumber: 2,
    })
    expect(result[1]).toEqual({
      absolutePath: videoFilePath,
      seasonNumber: 1,
      episodeNumber: 1,
    })
    expect(consoleLogSpy).toHaveBeenCalledWith(`Add media file "${videoFilePath}" season ${seasonNumber} episode ${episodeNumber}`)
  })

  it('should update existing file when videoFilePath already exists', () => {
    const mediaFiles: MediaFileMetadata[] = [
      {
        absolutePath: '/media/tvshow/season1/episode1.mkv',
        seasonNumber: 1,
        episodeNumber: 2, // Wrong episode number
      } as MediaFileMetadata,
    ]
    const videoFilePath = '/media/tvshow/season1/episode1.mkv'
    const seasonNumber = 1
    const episodeNumber = 1 // Correct episode number
    
    const result = updateMediaFileMetadatas(mediaFiles, videoFilePath, seasonNumber, episodeNumber)
    
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      absolutePath: videoFilePath,
      seasonNumber: 1,
      episodeNumber: 1,
    })
    expect(consoleLogSpy).toHaveBeenCalledWith(`Update media file "${videoFilePath}" from season 1 episode 2 to season ${seasonNumber} episode ${episodeNumber}`)
  })

  it('should update existing file with undefined season/episode numbers', () => {
    const mediaFiles: MediaFileMetadata[] = [
      {
        absolutePath: '/media/tvshow/season1/episode1.mkv',
        seasonNumber: undefined,
        episodeNumber: undefined,
      } as MediaFileMetadata,
    ]
    const videoFilePath = '/media/tvshow/season1/episode1.mkv'
    const seasonNumber = 1
    const episodeNumber = 1
    
    const result = updateMediaFileMetadatas(mediaFiles, videoFilePath, seasonNumber, episodeNumber)
    
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      absolutePath: videoFilePath,
      seasonNumber: 1,
      episodeNumber: 1,
    })
    expect(consoleLogSpy).toHaveBeenCalledWith(`Update media file "${videoFilePath}" from season ? episode ? to season ${seasonNumber} episode ${episodeNumber}`)
  })

  it('should preserve other files when updating one file', () => {
    const mediaFiles: MediaFileMetadata[] = [
      {
        absolutePath: '/media/tvshow/season1/episode1.mkv',
        seasonNumber: 1,
        episodeNumber: 1,
      } as MediaFileMetadata,
      {
        absolutePath: '/media/tvshow/season1/episode2.mkv',
        seasonNumber: 1,
        episodeNumber: 2,
      } as MediaFileMetadata,
      {
        absolutePath: '/media/tvshow/season2/episode1.mkv',
        seasonNumber: 2,
        episodeNumber: 1,
      } as MediaFileMetadata,
    ]
    const videoFilePath = '/media/tvshow/season1/episode1.mkv'
    const seasonNumber = 1
    const episodeNumber = 5 // Update to episode 5
    
    const result = updateMediaFileMetadatas(mediaFiles, videoFilePath, seasonNumber, episodeNumber)
    
    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({
      absolutePath: '/media/tvshow/season1/episode1.mkv',
      seasonNumber: 1,
      episodeNumber: 5, // Updated
    })
    expect(result[1]).toEqual({
      absolutePath: '/media/tvshow/season1/episode2.mkv',
      seasonNumber: 1,
      episodeNumber: 2, // Unchanged
    })
    expect(result[2]).toEqual({
      absolutePath: '/media/tvshow/season2/episode1.mkv',
      seasonNumber: 2,
      episodeNumber: 1, // Unchanged
    })
  })

  it('should handle multiple seasons correctly', () => {
    const mediaFiles: MediaFileMetadata[] = [
      {
        absolutePath: '/media/tvshow/season1/episode1.mkv',
        seasonNumber: 1,
        episodeNumber: 1,
      } as MediaFileMetadata,
    ]
    const videoFilePath = '/media/tvshow/season2/episode3.mkv'
    const seasonNumber = 2
    const episodeNumber = 3
    
    const result = updateMediaFileMetadatas(mediaFiles, videoFilePath, seasonNumber, episodeNumber)
    
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      absolutePath: '/media/tvshow/season1/episode1.mkv',
      seasonNumber: 1,
      episodeNumber: 1,
    })
    expect(result[1]).toEqual({
      absolutePath: videoFilePath,
      seasonNumber: 2,
      episodeNumber: 3,
    })
  })

  it('should not mutate the input array', () => {
    const mediaFiles: MediaFileMetadata[] = [
      {
        absolutePath: '/media/tvshow/season1/episode1.mkv',
        seasonNumber: 1,
        episodeNumber: 1,
      } as MediaFileMetadata,
    ]
    const videoFilePath = '/media/tvshow/season1/episode2.mkv'
    const seasonNumber = 1
    const episodeNumber = 2
    
    const result = updateMediaFileMetadatas(mediaFiles, videoFilePath, seasonNumber, episodeNumber)
    
    // Original array should not be modified
    expect(mediaFiles).toHaveLength(1)
    expect(result).toHaveLength(2)
    expect(mediaFiles[0]?.episodeNumber).toBe(1)
    expect(result[1]?.episodeNumber).toBe(2)
  })

  it('should handle case-sensitive file paths correctly', () => {
    const mediaFiles: MediaFileMetadata[] = [
      {
        absolutePath: '/media/tvshow/Season1/Episode1.mkv',
        seasonNumber: 1,
        episodeNumber: 1,
      } as MediaFileMetadata,
    ]
    const videoFilePath = '/media/tvshow/season1/episode1.mkv' // Different case
    const seasonNumber = 1
    const episodeNumber = 2
    
    // Should be treated as different files (case-sensitive)
    const result = updateMediaFileMetadatas(mediaFiles, videoFilePath, seasonNumber, episodeNumber)
    
    expect(result).toHaveLength(2)
    expect(result[0]?.absolutePath).toBe('/media/tvshow/Season1/Episode1.mkv')
    expect(result[1]?.absolutePath).toBe('/media/tvshow/season1/episode1.mkv')
  })

  it('should handle Windows path format correctly', () => {
    const mediaFiles: MediaFileMetadata[] = []
    const videoFilePath = 'C:\\media\\tvshow\\season1\\episode1.mkv'
    const seasonNumber = 1
    const episodeNumber = 1
    
    const result = updateMediaFileMetadatas(mediaFiles, videoFilePath, seasonNumber, episodeNumber)
    
    expect(result).toHaveLength(1)
    expect(result[0]?.absolutePath).toBe(videoFilePath)
    expect(result[0]?.seasonNumber).toBe(1)
    expect(result[0]?.episodeNumber).toBe(1)
  })

  it('should handle POSIX path format correctly', () => {
    const mediaFiles: MediaFileMetadata[] = []
    const videoFilePath = '/media/tvshow/season1/episode1.mkv'
    const seasonNumber = 1
    const episodeNumber = 1
    
    const result = updateMediaFileMetadatas(mediaFiles, videoFilePath, seasonNumber, episodeNumber)
    
    expect(result).toHaveLength(1)
    expect(result[0]?.absolutePath).toBe(videoFilePath)
    expect(result[0]?.seasonNumber).toBe(1)
    expect(result[0]?.episodeNumber).toBe(1)
  })

  it('should update file when moving from one season/episode to another', () => {
    const mediaFiles: MediaFileMetadata[] = [
      {
        absolutePath: '/media/tvshow/season1/episode1.mkv',
        seasonNumber: 1,
        episodeNumber: 1,
      } as MediaFileMetadata,
    ]
    const videoFilePath = '/media/tvshow/season1/episode1.mkv'
    const seasonNumber = 2 // Moving to season 2
    const episodeNumber = 5 // Moving to episode 5
    
    const result = updateMediaFileMetadatas(mediaFiles, videoFilePath, seasonNumber, episodeNumber)
    
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      absolutePath: videoFilePath,
      seasonNumber: 2,
      episodeNumber: 5,
    })
    expect(consoleLogSpy).toHaveBeenCalledWith(`Update media file "${videoFilePath}" from season 1 episode 1 to season ${seasonNumber} episode ${episodeNumber}`)
  })
})

describe('recognizeEpisodes', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  let mockUpdateMediaMetadata: ReturnType<typeof vi.fn>

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockUpdateMediaMetadata = vi.fn()
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
    vi.clearAllMocks()
  })

  const createMockSeasonModel = (
    seasonNumber: number,
    episodeNumber: number,
    videoFilePath: string
  ): SeasonModel => ({
    season: {
      id: seasonNumber,
      name: `Season ${seasonNumber}`,
      overview: '',
      poster_path: null,
      season_number: seasonNumber,
      air_date: '2024-01-01',
      episode_count: 1,
      episodes: [
        {
          id: seasonNumber * 100 + episodeNumber,
          name: `Episode ${episodeNumber}`,
          overview: '',
          still_path: null,
          air_date: '2024-01-01',
          episode_number: episodeNumber,
          season_number: seasonNumber,
          vote_average: 8.5,
          vote_count: 100,
          runtime: 42,
        },
      ],
    },
    episodes: [
      {
        episode: {
          id: seasonNumber * 100 + episodeNumber,
          name: `Episode ${episodeNumber}`,
          overview: '',
          still_path: null,
          air_date: '2024-01-01',
          episode_number: episodeNumber,
          season_number: seasonNumber,
          vote_average: 8.5,
          vote_count: 100,
          runtime: 42,
        },
        files: [
          {
            type: 'video',
            path: videoFilePath,
          } as FileProps,
        ],
      },
    ],
  })

  const createMockMediaMetadata = (overrides?: Partial<MediaMetadata>): MediaMetadata => ({
    mediaFolderPath: '/media/tvshow',
    ...overrides,
  } as MediaMetadata)

  it('should recognize episodes and call updateMediaMetadata with correct metadata', async () => {
    const seasons: SeasonModel[] = [
      createMockSeasonModel(1, 1, '/media/tvshow/season1/episode1.mkv'),
      createMockSeasonModel(1, 2, '/media/tvshow/season1/episode2.mkv'),
    ]
    const mediaMetadata = createMockMediaMetadata()

    await recognizeEpisodes(seasons, mediaMetadata, mockUpdateMediaMetadata)

    expect(consoleLogSpy).toHaveBeenCalledWith(
      `[TvShowPanelUtils] recognized episodes:`,
      expect.arrayContaining([
        expect.objectContaining({
          seasonNumber: 1,
          episodeNumber: 1,
          videoFilePath: '/media/tvshow/season1/episode1.mkv',
        }),
        expect.objectContaining({
          seasonNumber: 1,
          episodeNumber: 2,
          videoFilePath: '/media/tvshow/season1/episode2.mkv',
        }),
      ])
    )

    expect(mockUpdateMediaMetadata).toHaveBeenCalledTimes(1)
    expect(mockUpdateMediaMetadata).toHaveBeenCalledWith(
      '/media/tvshow',
      expect.objectContaining({
        mediaFolderPath: '/media/tvshow',
        mediaFiles: expect.arrayContaining([
          expect.objectContaining({
            absolutePath: '/media/tvshow/season1/episode1.mkv',
            seasonNumber: 1,
            episodeNumber: 1,
          }),
          expect.objectContaining({
            absolutePath: '/media/tvshow/season1/episode2.mkv',
            seasonNumber: 1,
            episodeNumber: 2,
          }),
        ]),
      })
    )
  })

  it('should handle empty seasons array', async () => {
    const seasons: SeasonModel[] = []
    const mediaMetadata = createMockMediaMetadata()

    await recognizeEpisodes(seasons, mediaMetadata, mockUpdateMediaMetadata)

    expect(mockUpdateMediaMetadata).toHaveBeenCalledTimes(1)
    expect(mockUpdateMediaMetadata).toHaveBeenCalledWith(
      '/media/tvshow',
      expect.objectContaining({
        mediaFolderPath: '/media/tvshow',
        mediaFiles: [],
      })
    )
  })

  it('should handle seasons with no video files', async () => {
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
                path: '/media/tvshow/season1/episode1.srt',
              } as FileProps,
            ],
          },
        ],
      },
    ]
    const mediaMetadata = createMockMediaMetadata()

    await recognizeEpisodes(seasons, mediaMetadata, mockUpdateMediaMetadata)

    expect(mockUpdateMediaMetadata).toHaveBeenCalledTimes(1)
    expect(mockUpdateMediaMetadata).toHaveBeenCalledWith(
      '/media/tvshow',
      expect.objectContaining({
        mediaFolderPath: '/media/tvshow',
        mediaFiles: [],
      })
    )
  })

  it('should handle multiple seasons correctly', async () => {
    const seasons: SeasonModel[] = [
      createMockSeasonModel(1, 1, '/media/tvshow/s01e01.mkv'),
      createMockSeasonModel(2, 1, '/media/tvshow/s02e01.mkv'),
      createMockSeasonModel(2, 2, '/media/tvshow/s02e02.mkv'),
    ]
    const mediaMetadata = createMockMediaMetadata()

    await recognizeEpisodes(seasons, mediaMetadata, mockUpdateMediaMetadata)

    expect(mockUpdateMediaMetadata).toHaveBeenCalledTimes(1)
    const callArgs = mockUpdateMediaMetadata.mock.calls[0]
    expect(callArgs[1].mediaFiles).toHaveLength(3)
    expect(callArgs[1].mediaFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          absolutePath: '/media/tvshow/s01e01.mkv',
          seasonNumber: 1,
          episodeNumber: 1,
        }),
        expect.objectContaining({
          absolutePath: '/media/tvshow/s02e01.mkv',
          seasonNumber: 2,
          episodeNumber: 1,
        }),
        expect.objectContaining({
          absolutePath: '/media/tvshow/s02e02.mkv',
          seasonNumber: 2,
          episodeNumber: 2,
        }),
      ])
    )
  })

  it('should preserve existing mediaMetadata properties', async () => {
    const seasons: SeasonModel[] = [
      createMockSeasonModel(1, 1, '/media/tvshow/episode1.mkv'),
    ]
    const mediaMetadata = createMockMediaMetadata({
      type: 'tvshow-folder',
      tmdbTvShow: {} as any,
    })

    await recognizeEpisodes(seasons, mediaMetadata, mockUpdateMediaMetadata)

    expect(mockUpdateMediaMetadata).toHaveBeenCalledTimes(1)
    const callArgs = mockUpdateMediaMetadata.mock.calls[0]
    expect(callArgs[1]).toEqual(
      expect.objectContaining({
        mediaFolderPath: '/media/tvshow',
        type: 'tvshow-folder',
        tmdbTvShow: {},
        mediaFiles: expect.any(Array),
      })
    )
  })

  it('should replace existing mediaFiles with new ones', async () => {
    const seasons: SeasonModel[] = [
      createMockSeasonModel(1, 1, '/media/tvshow/episode1.mkv'),
    ]
    const mediaMetadata = createMockMediaMetadata({
      mediaFiles: [
        {
          absolutePath: '/media/tvshow/old-episode.mkv',
          seasonNumber: 1,
          episodeNumber: 5,
        } as MediaFileMetadata,
      ],
    })

    await recognizeEpisodes(seasons, mediaMetadata, mockUpdateMediaMetadata)

    expect(mockUpdateMediaMetadata).toHaveBeenCalledTimes(1)
    const callArgs = mockUpdateMediaMetadata.mock.calls[0]
    expect(callArgs[1].mediaFiles).toEqual([
      expect.objectContaining({
        absolutePath: '/media/tvshow/episode1.mkv',
        seasonNumber: 1,
        episodeNumber: 1,
      }),
    ])
    // Old mediaFiles should be replaced
    expect(callArgs[1].mediaFiles).not.toContainEqual(
      expect.objectContaining({
        absolutePath: '/media/tvshow/old-episode.mkv',
      })
    )
  })

  it('should not call updateMediaMetadata when mediaFolderPath is undefined', async () => {
    const seasons: SeasonModel[] = [
      createMockSeasonModel(1, 1, '/media/tvshow/episode1.mkv'),
    ]
    const mediaMetadata = createMockMediaMetadata({
      mediaFolderPath: undefined,
    })

    await recognizeEpisodes(seasons, mediaMetadata, mockUpdateMediaMetadata)

    expect(mockUpdateMediaMetadata).not.toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `[TvShowPanelUtils] mediaFolderPath is undefined, cannot update media metadata`
    )
  })

  it('should not call updateMediaMetadata when mediaFolderPath is null', async () => {
    const seasons: SeasonModel[] = [
      createMockSeasonModel(1, 1, '/media/tvshow/episode1.mkv'),
    ]
    const mediaMetadata = createMockMediaMetadata({
      mediaFolderPath: null as any,
    })

    await recognizeEpisodes(seasons, mediaMetadata, mockUpdateMediaMetadata)

    expect(mockUpdateMediaMetadata).not.toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `[TvShowPanelUtils] mediaFolderPath is undefined, cannot update media metadata`
    )
  })

  it('should handle mixed seasons with and without video files', async () => {
    const seasons: SeasonModel[] = [
      createMockSeasonModel(1, 1, '/media/tvshow/episode1.mkv'),
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
                path: '/media/tvshow/episode2.srt',
              } as FileProps,
            ],
          },
        ],
      },
    ]
    const mediaMetadata = createMockMediaMetadata()

    await recognizeEpisodes(seasons, mediaMetadata, mockUpdateMediaMetadata)

    expect(mockUpdateMediaMetadata).toHaveBeenCalledTimes(1)
    const callArgs = mockUpdateMediaMetadata.mock.calls[0]
    // Should only include episode with video file
    expect(callArgs[1].mediaFiles).toHaveLength(1)
    expect(callArgs[1].mediaFiles[0]).toEqual(
      expect.objectContaining({
        absolutePath: '/media/tvshow/episode1.mkv',
        seasonNumber: 1,
        episodeNumber: 1,
      })
    )
  })

  it('should handle Windows path format in mediaFolderPath', async () => {
    const seasons: SeasonModel[] = [
      createMockSeasonModel(1, 1, 'C:\\media\\tvshow\\episode1.mkv'),
    ]
    const mediaMetadata = createMockMediaMetadata({
      mediaFolderPath: 'C:\\media\\tvshow',
    })

    await recognizeEpisodes(seasons, mediaMetadata, mockUpdateMediaMetadata)

    expect(mockUpdateMediaMetadata).toHaveBeenCalledTimes(1)
    expect(mockUpdateMediaMetadata).toHaveBeenCalledWith(
      'C:\\media\\tvshow',
      expect.objectContaining({
        mediaFolderPath: 'C:\\media\\tvshow',
        mediaFiles: expect.arrayContaining([
          expect.objectContaining({
            absolutePath: 'C:\\media\\tvshow\\episode1.mkv',
          }),
        ]),
      })
    )
  })

  it('should correctly map all recognized episodes to MediaFileMetadata format', async () => {
    const seasons: SeasonModel[] = [
      createMockSeasonModel(1, 1, '/media/tvshow/s01e01.mkv'),
      createMockSeasonModel(1, 2, '/media/tvshow/s01e02.mkv'),
      createMockSeasonModel(2, 1, '/media/tvshow/s02e01.mkv'),
    ]
    const mediaMetadata = createMockMediaMetadata()

    await recognizeEpisodes(seasons, mediaMetadata, mockUpdateMediaMetadata)

    expect(mockUpdateMediaMetadata).toHaveBeenCalledTimes(1)
    const callArgs = mockUpdateMediaMetadata.mock.calls[0]
    const mediaFiles = callArgs[1].mediaFiles as MediaFileMetadata[]

    expect(mediaFiles).toHaveLength(3)
    mediaFiles.forEach((file) => {
      expect(file).toHaveProperty('absolutePath')
      expect(file).toHaveProperty('seasonNumber')
      expect(file).toHaveProperty('episodeNumber')
      expect(typeof file.seasonNumber).toBe('number')
      expect(typeof file.episodeNumber).toBe('number')
      expect(typeof file.absolutePath).toBe('string')
    })
  })
})
