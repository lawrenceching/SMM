import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { _buildMappingFromSeasonModels, mapTagToFileType, newPath, buildFileProps, renameFiles, updateMediaFileMetadatas, recognizeEpisodes, tryToRecognizeMediaFolderByNFO, buildTmdbEpisodeByNFO, buildSeasonsByRecognizeMediaFilePlan, buildSeasonsByRenameFilesPlan, recognizeMediaFilesByRules, buildSeasonsModelFromMediaMetadata } from './TvShowPanelUtils'
import type { SeasonModel } from './TvShowPanel'
import type { FileProps } from '@/lib/types'
import type { MediaMetadata, MediaFileMetadata } from '@core/types'
import { readFile } from '@/api/readFile'
import { parseEpisodeNfo } from '@/lib/nfo'

vi.mock('@/api/readFile')
vi.mock('@/lib/nfo')

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
    // Verify all expected files are present regardless of order
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          absolutePath: '/media/tvshow/season1/episode1.mkv',
          seasonNumber: 1,
          episodeNumber: 5, // Updated
        }),
        expect.objectContaining({
          absolutePath: '/media/tvshow/season1/episode2.mkv',
          seasonNumber: 1,
          episodeNumber: 2, // Unchanged
        }),
        expect.objectContaining({
          absolutePath: '/media/tvshow/season2/episode1.mkv',
          seasonNumber: 2,
          episodeNumber: 1, // Unchanged
        }),
      ])
    )
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
    
  })

  it('should update absolutePath for the same season/episode', () => {
    const mediaFiles: MediaFileMetadata[] = [
      {
        absolutePath: '/media/tvshow/season1/episode1_op.mkv',
        seasonNumber: 1,
        episodeNumber: 1,
      } as MediaFileMetadata,
    ]
    const videoFilePath = '/media/tvshow/season1/episode1.mkv'
    const seasonNumber = 1 // Moving to season 2
    const episodeNumber = 1 // Moving to episode 5
    
    const result = updateMediaFileMetadatas(mediaFiles, videoFilePath, seasonNumber, episodeNumber)
    
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      absolutePath: videoFilePath,
      seasonNumber: seasonNumber,
      episodeNumber: episodeNumber,
    })
    
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
      }),
      expect.objectContaining({ traceId: expect.any(String) })
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
      }),
      expect.objectContaining({ traceId: expect.any(String) })
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
      }),
      expect.objectContaining({ traceId: expect.any(String) })
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
      }),
      expect.objectContaining({ traceId: expect.any(String) })
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

describe('tryToRecognizeMediaFolderByNFO', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.clearAllMocks()
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  it('should successfully recognize media folder by NFO files', async () => {
    const mockMediaMetadata: MediaMetadata = {
      mediaFolderPath: '/media/tvshow',
      files: [
        '/media/tvshow/tvshow.nfo',
        '/media/tvshow/Show Name - S01E01.nfo',
        '/media/tvshow/Show Name - S01E02.nfo',
        '/media/tvshow/Show Name - S01E01.mkv',
        '/media/tvshow/Show Name - S01E02.mkv',
      ],
      mediaFiles: [],
    }

    const tvshowNfoXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<tvshow>
  <title>Test Show</title>
  <tmdbid>12345</tmdbid>
  <plot>Test plot</plot>
</tvshow>`

    const episodeNfo1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<episodedetails>
  <title>Episode 1</title>
  <season>1</season>
  <episode>1</episode>
  <original_filename>Show Name - S01E01.mkv</original_filename>
</episodedetails>`

    const episodeNfo2Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<episodedetails>
  <title>Episode 2</title>
  <season>1</season>
  <episode>2</episode>
  <original_filename>Show Name - S01E02.mkv</original_filename>
</episodedetails>`

    // Mock readFile to return different XML for tvshow.nfo and episode NFO files
    vi.mocked(readFile).mockImplementation(async (path: string) => {
      if (path === '/media/tvshow/tvshow.nfo') {
        return { data: tvshowNfoXml }
      } else if (path === '/media/tvshow/Show Name - S01E01.nfo') {
        return { data: episodeNfo1Xml }
      } else if (path === '/media/tvshow/Show Name - S01E02.nfo') {
        return { data: episodeNfo2Xml }
      }
      return { error: 'File not found' }
    })

    // Mock parseEpisodeNfo to return parsed episode data
    vi.mocked(parseEpisodeNfo).mockImplementation(async (xml: string) => {
      if (xml === episodeNfo1Xml) {
        return {
          title: 'Episode 1',
          season: 1,
          episode: 1,
          originalFilename: 'Show Name - S01E01.mkv',
        }
      } else if (xml === episodeNfo2Xml) {
        return {
          title: 'Episode 2',
          season: 1,
          episode: 2,
          originalFilename: 'Show Name - S01E02.mkv',
        }
      }
      return undefined
    })

    const result = await tryToRecognizeMediaFolderByNFO(mockMediaMetadata)

    expect(result).toBeDefined()
    expect(result?.tmdbTvShow).toBeDefined()
    expect(result?.tmdbTvShow?.id).toBe(12345)
    expect(result?.tmdbTvShow?.name).toBe('Test Show')
    
    // Verify seasons and episodes are populated
    expect(result?.tmdbTvShow?.seasons).toHaveLength(1)
    expect(result?.tmdbTvShow?.seasons[0]?.season_number).toBe(1)
    expect(result?.tmdbTvShow?.seasons[0]?.episodes).toHaveLength(2)
    
    // Verify episodes are correctly structured
    // Note: buildTmdbEpisodeByNFO will parse the XML and return episodes with id: 0 
    // when no ID is present in the XML (which is the case here)
    const episodes = result?.tmdbTvShow?.seasons[0]?.episodes || []
    expect(episodes.length).toBe(2)
    
    const episode1 = episodes.find(ep => ep.episode_number === 1 && ep.season_number === 1)
    const episode2 = episodes.find(ep => ep.episode_number === 2 && ep.season_number === 1)
    
    expect(episode1).toBeDefined()
    expect(episode2).toBeDefined()
    expect(episode1?.name).toBe('Episode 1')
    expect(episode2?.name).toBe('Episode 2')
    // When XML has no ID, buildTmdbEpisodeByNFO returns id: 0
    expect(episode1?.id).toBe(0)
    expect(episode2?.id).toBe(0)

    // Verify mediaFiles are updated
    expect(result?.mediaFiles).toHaveLength(2)
    expect(result?.mediaFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          absolutePath: '/media/tvshow/Show Name - S01E01.mkv',
          seasonNumber: 1,
          episodeNumber: 1,
        }),
        expect.objectContaining({
          absolutePath: '/media/tvshow/Show Name - S01E02.mkv',
          seasonNumber: 1,
          episodeNumber: 2,
        }),
      ])
    )

    // Verify readFile was called for tvshow.nfo and each episode NFO file
    expect(readFile).toHaveBeenCalledTimes(3)
    expect(readFile).toHaveBeenCalledWith('/media/tvshow/tvshow.nfo', undefined)
    expect(readFile).toHaveBeenCalledWith('/media/tvshow/Show Name - S01E01.nfo', undefined)
    expect(readFile).toHaveBeenCalledWith('/media/tvshow/Show Name - S01E02.nfo', undefined)

    // Verify parseEpisodeNfo was called for each episode XML
    expect(parseEpisodeNfo).toHaveBeenCalledTimes(2)
    expect(parseEpisodeNfo).toHaveBeenCalledWith(episodeNfo1Xml)
    expect(parseEpisodeNfo).toHaveBeenCalledWith(episodeNfo2Xml)

    // Note: We don't spy on buildTmdbTVShowDetailsByNFO and buildTmdbEpisodeByNFO
    // because they are called directly within the same module, so spies won't intercept them.
    // Instead, we verify the actual behavior - that the TV show and episodes are correctly parsed.
  })
})

describe('buildTmdbEpisodeByNFO', () => {

  it('should build TMDBEpisode with minimal fields', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<episodedetails>
  <title>Test Episode</title>
  <season>1</season>
  <episode>1</episode>
</episodedetails>`
    
    const episode = buildTmdbEpisodeByNFO(xml)
    
    expect(episode).toBeDefined()
    expect(episode?.id).toBe(0)
    expect(episode?.name).toBe('Test Episode')
    expect(episode?.overview).toBe('')
    expect(episode?.still_path).toBeNull()
    expect(episode?.air_date).toBe('')
    expect(episode?.episode_number).toBe(1)
    expect(episode?.season_number).toBe(1)
    expect(episode?.vote_average).toBe(0)
    expect(episode?.vote_count).toBe(0)
    expect(episode?.runtime).toBe(0)
  })

  it('should use id element when uniqueid type="tmdb" is not present', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<episodedetails>
  <title>Test</title>
  <id>12345</id>
  <season>1</season>
  <episode>1</episode>
</episodedetails>`
    
    const episode = buildTmdbEpisodeByNFO(xml)
    
    expect(episode).toBeDefined()
    expect(episode?.id).toBe(12345)
  })

  it('should prefer uniqueid type="tmdb" over id element', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<episodedetails>
  <title>Test</title>
  <id>99999</id>
  <uniqueid type="tmdb">12345</uniqueid>
  <season>1</season>
  <episode>1</episode>
</episodedetails>`
    
    const episode = buildTmdbEpisodeByNFO(xml)
    
    expect(episode).toBeDefined()
    expect(episode?.id).toBe(12345) // Should prefer uniqueid type="tmdb"
  })

  it('should extract still_path from full TMDB URL', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<episodedetails>
  <title>Test</title>
  <season>1</season>
  <episode>1</episode>
  <thumb>https://image.tmdb.org/t/p/w500/test-image.jpg</thumb>
</episodedetails>`
    
    const episode = buildTmdbEpisodeByNFO(xml)
    
    expect(episode).toBeDefined()
    expect(episode?.still_path).toBe('/test-image.jpg')
  })

  it('should handle still_path that is already a path', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<episodedetails>
  <title>Test</title>
  <season>1</season>
  <episode>1</episode>
  <thumb>/test-image.jpg</thumb>
</episodedetails>`
    
    const episode = buildTmdbEpisodeByNFO(xml)
    
    expect(episode).toBeDefined()
    expect(episode?.still_path).toBe('/test-image.jpg')
  })

  it('should prefer premiered over aired for air_date', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<episodedetails>
  <title>Test</title>
  <season>1</season>
  <episode>1</episode>
  <premiered>2022-01-01</premiered>
  <aired>2022-01-02</aired>
</episodedetails>`
    
    const episode = buildTmdbEpisodeByNFO(xml)
    
    expect(episode).toBeDefined()
    expect(episode?.air_date).toBe('2022-01-01') // Should prefer premiered
  })

  it('should use aired when premiered is not present', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<episodedetails>
  <title>Test</title>
  <season>1</season>
  <episode>1</episode>
  <aired>2022-01-02</aired>
</episodedetails>`
    
    const episode = buildTmdbEpisodeByNFO(xml)
    
    expect(episode).toBeDefined()
    expect(episode?.air_date).toBe('2022-01-02')
  })

  it('should extract vote_average and vote_count from ratings', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<episodedetails>
  <title>Test</title>
  <season>1</season>
  <episode>1</episode>
  <ratings>
    <rating name="themoviedb">
      <value>9.5</value>
      <votes>100</votes>
    </rating>
  </ratings>
</episodedetails>`
    
    const episode = buildTmdbEpisodeByNFO(xml)
    
    expect(episode).toBeDefined()
    expect(episode?.vote_average).toBe(9.5)
    expect(episode?.vote_count).toBe(100)
  })

  it('should handle decimal vote_average', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<episodedetails>
  <title>Test</title>
  <season>1</season>
  <episode>1</episode>
  <ratings>
    <rating name="themoviedb">
      <value>8.75</value>
      <votes>50</votes>
    </rating>
  </ratings>
</episodedetails>`
    
    const episode = buildTmdbEpisodeByNFO(xml)
    
    expect(episode).toBeDefined()
    expect(episode?.vote_average).toBe(8.75)
  })

  it('should return undefined for invalid XML', () => {
    const invalidXml = `<?xml version="1.0"?>
<episodedetails>
  <title>Test</title>
  <unclosed-tag>
</episodedetails>`
    
    const episode = buildTmdbEpisodeByNFO(invalidXml)
    
    expect(episode).toBeUndefined()
  })

  it('should return undefined when episodedetails root element is missing', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<tvshow>
  <title>Test</title>
</tvshow>`
    
    const episode = buildTmdbEpisodeByNFO(xml)
    
    expect(episode).toBeUndefined()
  })

  it('should handle missing optional fields gracefully', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<episodedetails>
  <season>2</season>
  <episode>5</episode>
</episodedetails>`
    
    const episode = buildTmdbEpisodeByNFO(xml)
    
    expect(episode).toBeDefined()
    expect(episode?.id).toBe(0)
    expect(episode?.name).toBe('')
    expect(episode?.overview).toBe('')
    expect(episode?.still_path).toBeNull()
    expect(episode?.air_date).toBe('')
    expect(episode?.episode_number).toBe(5)
    expect(episode?.season_number).toBe(2)
    expect(episode?.vote_average).toBe(0)
    expect(episode?.vote_count).toBe(0)
    expect(episode?.runtime).toBe(0)
  })

  it('should handle invalid numeric values', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<episodedetails>
  <title>Test</title>
  <id>invalid</id>
  <season>not-a-number</season>
  <episode>also-invalid</episode>
  <runtime>bad</runtime>
  <ratings>
    <rating name="themoviedb">
      <value>invalid</value>
      <votes>bad</votes>
    </rating>
  </ratings>
</episodedetails>`
    
    const episode = buildTmdbEpisodeByNFO(xml)
    
    expect(episode).toBeDefined()
    expect(episode?.id).toBe(0)
    expect(episode?.season_number).toBe(0)
    expect(episode?.episode_number).toBe(0)
    expect(episode?.runtime).toBe(0)
    expect(episode?.vote_average).toBe(0)
    expect(episode?.vote_count).toBe(0)
  })

  it('should handle empty string values', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<episodedetails>
  <title></title>
  <plot></plot>
  <season>1</season>
  <episode>1</episode>
</episodedetails>`
    
    const episode = buildTmdbEpisodeByNFO(xml)
    
    expect(episode).toBeDefined()
    expect(episode?.name).toBe('')
    expect(episode?.overview).toBe('')
  })
})

describe('buildSeasonsByRecognizeMediaFilePlan', () => {
  it('returns SeasonModel[] with one season and one episode when plan has one recognized file and mm has tmdbTvShow and files', () => {
    const mediaFolderPath = '/media/show'
    const videoPath = '/media/show/Season 01/S01E01.mkv'
    const mm: MediaMetadata = {
      mediaFolderPath,
      files: [videoPath],
      tmdbTvShow: {
        id: 1,
        name: 'Show',
        original_name: '',
        overview: '',
        poster_path: null,
        backdrop_path: null,
        first_air_date: '2024-01-01',
        vote_average: 0,
        vote_count: 0,
        popularity: 0,
        genre_ids: [],
        origin_country: [],
        media_type: 'tv',
        number_of_seasons: 1,
        number_of_episodes: 1,
        seasons: [
          {
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
                name: 'Pilot',
                overview: '',
                still_path: null,
                air_date: '2024-01-01',
                episode_number: 1,
                season_number: 1,
                vote_average: 0,
                vote_count: 0,
                runtime: 42,
              },
            ],
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
    const plan = {
      id: 'plan-uuid',
      task: 'recognize-media-file' as const,
      status: 'pending' as const,
      mediaFolderPath,
      files: [{ season: 1, episode: 1, path: videoPath }],
    }

    const result = buildSeasonsByRecognizeMediaFilePlan(mm, plan)

    expect(result).toHaveLength(1)
    expect(result[0].season.season_number).toBe(1)
    expect(result[0].episodes).toHaveLength(1)
    expect(result[0].episodes[0].episode.episode_number).toBe(1)
    expect(result[0].episodes[0].episode.name).toBe('Pilot')
    expect(result[0].episodes[0].files).toContainEqual({ type: 'video', path: videoPath })
  })

  it('returns empty array when plan.files is empty', () => {
    const mm: MediaMetadata = {
      mediaFolderPath: '/media/show',
      files: [],
      tmdbTvShow: {} as any,
    }
    const plan = {
      id: 'plan-uuid',
      task: 'recognize-media-file' as const,
      status: 'pending' as const,
      mediaFolderPath: '/media/show',
      files: [],
    }

    const result = buildSeasonsByRecognizeMediaFilePlan(mm, plan)

    expect(result).toEqual([])
  })

  it('returns empty array when plan.files is undefined', () => {
    const mm: MediaMetadata = {
      mediaFolderPath: '/media/show',
      files: [],
      tmdbTvShow: {} as any,
    }
    const plan = {
      id: 'plan-uuid',
      task: 'recognize-media-file' as const,
      status: 'pending' as const,
      mediaFolderPath: '/media/show',
      files: undefined as any,
    }

    const result = buildSeasonsByRecognizeMediaFilePlan(mm, plan)

    expect(result).toEqual([])
  })

  it('handles multiple episodes in one season', () => {
    const mediaFolderPath = '/media/show'
    const mm: MediaMetadata = {
      mediaFolderPath,
      files: [
        '/media/show/Season 01/S01E01.mkv',
        '/media/show/Season 01/S01E02.mkv',
        '/media/show/Season 01/S01E03.mkv',
      ],
      tmdbTvShow: {
        id: 1,
        name: 'Show',
        seasons: [
          {
            id: 1,
            season_number: 1,
            episodes: [
              { id: 101, name: 'Ep 1', episode_number: 1, season_number: 1 },
              { id: 102, name: 'Ep 2', episode_number: 2, season_number: 1 },
              { id: 103, name: 'Ep 3', episode_number: 3, season_number: 1 },
            ],
          } as any,
        ],
      } as any,
    }
    const plan = {
      id: 'plan-uuid',
      task: 'recognize-media-file' as const,
      status: 'pending' as const,
      mediaFolderPath,
      files: [
        { season: 1, episode: 2, path: '/media/show/Season 01/S01E02.mkv' },
        { season: 1, episode: 1, path: '/media/show/Season 01/S01E01.mkv' },
        { season: 1, episode: 3, path: '/media/show/Season 01/S01E03.mkv' },
      ],
    }

    const result = buildSeasonsByRecognizeMediaFilePlan(mm, plan)

    expect(result).toHaveLength(1)
    expect(result[0].season.season_number).toBe(1)
    expect(result[0].episodes).toHaveLength(3)
    // Episodes should be sorted by episode_number
    expect(result[0].episodes[0].episode.episode_number).toBe(1)
    expect(result[0].episodes[1].episode.episode_number).toBe(2)
    expect(result[0].episodes[2].episode.episode_number).toBe(3)
  })

  it('handles multiple seasons', () => {
    const mediaFolderPath = '/media/show'
    const mm: MediaMetadata = {
      mediaFolderPath,
      files: [
        '/media/show/Season 01/S01E01.mkv',
        '/media/show/Season 02/S02E01.mkv',
      ],
      tmdbTvShow: {
        id: 1,
        name: 'Show',
        seasons: [
          { id: 1, season_number: 1, episodes: [{ id: 101, name: 'S1E1', episode_number: 1, season_number: 1 }] } as any,
          { id: 2, season_number: 2, episodes: [{ id: 201, name: 'S2E1', episode_number: 1, season_number: 2 }] } as any,
        ],
      } as any,
    }
    const plan = {
      id: 'plan-uuid',
      task: 'recognize-media-file' as const,
      status: 'pending' as const,
      mediaFolderPath,
      files: [
        { season: 2, episode: 1, path: '/media/show/Season 02/S02E01.mkv' },
        { season: 1, episode: 1, path: '/media/show/Season 01/S01E01.mkv' },
      ],
    }

    const result = buildSeasonsByRecognizeMediaFilePlan(mm, plan)

    expect(result).toHaveLength(2)
    // Seasons should be sorted by season_number
    expect(result[0].season.season_number).toBe(1)
    expect(result[1].season.season_number).toBe(2)
  })

  it('creates default episode when episode not found in tmdbTvShow', () => {
    const mediaFolderPath = '/media/show'
    const videoPath = '/media/show/Season 01/S01E05.mkv'
    const mm: MediaMetadata = {
      mediaFolderPath,
      files: [videoPath],
      tmdbTvShow: {
        id: 1,
        name: 'Show',
        seasons: [
          {
            id: 1,
            season_number: 1,
            episodes: [
              { id: 101, name: 'Ep 1', episode_number: 1, season_number: 1 },
              // Episode 5 is missing
            ],
          } as any,
        ],
      } as any,
    }
    const plan = {
      id: 'plan-uuid',
      task: 'recognize-media-file' as const,
      status: 'pending' as const,
      mediaFolderPath,
      files: [{ season: 1, episode: 5, path: videoPath }],
    }

    const result = buildSeasonsByRecognizeMediaFilePlan(mm, plan)

    expect(result).toHaveLength(1)
    expect(result[0].episodes).toHaveLength(1)
    expect(result[0].episodes[0].episode.episode_number).toBe(5)
    expect(result[0].episodes[0].episode.name).toBe('')
    expect(result[0].episodes[0].episode.id).toBe(0)
  })

  it('creates default season when season not found in tmdbTvShow', () => {
    const mediaFolderPath = '/media/show'
    const videoPath = '/media/show/Season 99/S99E01.mkv'
    const mm: MediaMetadata = {
      mediaFolderPath,
      files: [videoPath],
      tmdbTvShow: {
        id: 1,
        name: 'Show',
        seasons: [
          { id: 1, season_number: 1, episodes: [] } as any,
          // Season 99 is missing
        ],
      } as any,
    }
    const plan = {
      id: 'plan-uuid',
      task: 'recognize-media-file' as const,
      status: 'pending' as const,
      mediaFolderPath,
      files: [{ season: 99, episode: 1, path: videoPath }],
    }

    const result = buildSeasonsByRecognizeMediaFilePlan(mm, plan)

    expect(result).toHaveLength(1)
    expect(result[0].season.season_number).toBe(99)
    expect(result[0].season.name).toBe('')
  })

  it('uses plan.mediaFolderPath when mm.mediaFolderPath is undefined', () => {
    const videoPath = '/media/show/Season 01/S01E01.mkv'
    const mm: MediaMetadata = {
      mediaFolderPath: undefined,
      files: [videoPath],
      tmdbTvShow: {
        id: 1,
        name: 'Show',
        seasons: [
          { id: 1, season_number: 1, episodes: [{ id: 101, name: 'Ep 1', episode_number: 1, season_number: 1 }] } as any,
        ],
      } as any,
    }
    const plan = {
      id: 'plan-uuid',
      task: 'recognize-media-file' as const,
      status: 'pending' as const,
      mediaFolderPath: '/media/show',
      files: [{ season: 1, episode: 1, path: videoPath }],
    }

    const result = buildSeasonsByRecognizeMediaFilePlan(mm, plan)

    expect(result).toHaveLength(1)
    expect(result[0].episodes[0].files[0].path).toBe(videoPath)
  })

  it('includes associated files when found', () => {
    const mediaFolderPath = '/media/show'
    const videoPath = '/media/show/Season 01/S01E01.mkv'
    // Associated files must share the same base name as the video file
    // findAssociatedFiles looks for files that match: base + .extension
    const subtitlePath = '/media/show/Season 01/S01E01.srt'
    const nfoPath = '/media/show/Season 01/S01E01.nfo'
    const mm: MediaMetadata = {
      mediaFolderPath,
      files: [videoPath, subtitlePath, nfoPath],
      tmdbTvShow: {
        id: 1,
        name: 'Show',
        seasons: [
          { id: 1, season_number: 1, episodes: [{ id: 101, name: 'Ep 1', episode_number: 1, season_number: 1 }] } as any,
        ],
      } as any,
    }
    const plan = {
      id: 'plan-uuid',
      task: 'recognize-media-file' as const,
      status: 'pending' as const,
      mediaFolderPath,
      files: [{ season: 1, episode: 1, path: videoPath }],
    }

    const result = buildSeasonsByRecognizeMediaFilePlan(mm, plan)

    expect(result).toHaveLength(1)
    expect(result[0].episodes).toHaveLength(1)
    expect(result[0].episodes[0].files.length).toBeGreaterThan(1)
    expect(result[0].episodes[0].files.some(f => f.type === 'video')).toBe(true)
    expect(result[0].episodes[0].files.some(f => f.type === 'subtitle')).toBe(true)
    expect(result[0].episodes[0].files.some(f => f.type === 'nfo')).toBe(true)
  })

  it('returns only video file when no associated files found', () => {
    const mediaFolderPath = '/media/show'
    const videoPath = '/media/show/Season 01/S01E01.mkv'
    const mm: MediaMetadata = {
      mediaFolderPath,
      files: [videoPath],
      tmdbTvShow: {
        id: 1,
        name: 'Show',
        seasons: [
          { id: 1, season_number: 1, episodes: [{ id: 101, name: 'Ep 1', episode_number: 1, season_number: 1 }] } as any,
        ],
      } as any,
    }
    const plan = {
      id: 'plan-uuid',
      task: 'recognize-media-file' as const,
      status: 'pending' as const,
      mediaFolderPath,
      files: [{ season: 1, episode: 1, path: videoPath }],
    }

    const result = buildSeasonsByRecognizeMediaFilePlan(mm, plan)

    expect(result).toHaveLength(1)
    expect(result[0].episodes).toHaveLength(1)
    expect(result[0].episodes[0].files).toEqual([{ type: 'video', path: videoPath }])
  })

  it('returns only video file when mm.files is empty', () => {
    const mediaFolderPath = '/media/show'
    const videoPath = '/media/show/Season 01/S01E01.mkv'
    const mm: MediaMetadata = {
      mediaFolderPath,
      files: [],
      tmdbTvShow: {
        id: 1,
        name: 'Show',
        seasons: [
          { id: 1, season_number: 1, episodes: [{ id: 101, name: 'Ep 1', episode_number: 1, season_number: 1 }] } as any,
        ],
      } as any,
    }
    const plan = {
      id: 'plan-uuid',
      task: 'recognize-media-file' as const,
      status: 'pending' as const,
      mediaFolderPath,
      files: [{ season: 1, episode: 1, path: videoPath }],
    }

    const result = buildSeasonsByRecognizeMediaFilePlan(mm, plan)

    expect(result).toHaveLength(1)
    expect(result[0].episodes).toHaveLength(1)
    expect(result[0].episodes[0].files).toEqual([{ type: 'video', path: videoPath }])
  })

  it('returns only video file when mm.files is undefined', () => {
    const mediaFolderPath = '/media/show'
    const videoPath = '/media/show/Season 01/S01E01.mkv'
    const mm: MediaMetadata = {
      mediaFolderPath,
      files: undefined,
      tmdbTvShow: {
        id: 1,
        name: 'Show',
        seasons: [
          { id: 1, season_number: 1, episodes: [{ id: 101, name: 'Ep 1', episode_number: 1, season_number: 1 }] } as any,
        ],
      } as any,
    }
    const plan = {
      id: 'plan-uuid',
      task: 'recognize-media-file' as const,
      status: 'pending' as const,
      mediaFolderPath,
      files: [{ season: 1, episode: 1, path: videoPath }],
    }

    const result = buildSeasonsByRecognizeMediaFilePlan(mm, plan)

    expect(result).toHaveLength(1)
    expect(result[0].episodes).toHaveLength(1)
    expect(result[0].episodes[0].files).toEqual([{ type: 'video', path: videoPath }])
  })

  it('handles tmdbTvShow being undefined', () => {
    const mediaFolderPath = '/media/show'
    const videoPath = '/media/show/Season 01/S01E01.mkv'
    const mm: MediaMetadata = {
      mediaFolderPath,
      files: [videoPath],
      tmdbTvShow: undefined,
    }
    const plan = {
      id: 'plan-uuid',
      task: 'recognize-media-file' as const,
      status: 'pending' as const,
      mediaFolderPath,
      files: [{ season: 1, episode: 1, path: videoPath }],
    }

    const result = buildSeasonsByRecognizeMediaFilePlan(mm, plan)

    expect(result).toHaveLength(1)
    expect(result[0].season.season_number).toBe(1)
    expect(result[0].episodes[0].episode.episode_number).toBe(1)
  })

  it('sorts episodes by episode_number within each season', () => {
    const mediaFolderPath = '/media/show'
    const mm: MediaMetadata = {
      mediaFolderPath,
      files: [
        '/media/show/S01E05.mkv',
        '/media/show/S01E01.mkv',
        '/media/show/S01E03.mkv',
        '/media/show/S01E02.mkv',
        '/media/show/S01E04.mkv',
      ],
      tmdbTvShow: {
        id: 1,
        name: 'Show',
        seasons: [{ id: 1, season_number: 1, episodes: [] } as any],
      } as any,
    }
    const plan = {
      id: 'plan-uuid',
      task: 'recognize-media-file' as const,
      status: 'pending' as const,
      mediaFolderPath,
      files: [
        { season: 1, episode: 5, path: '/media/show/S01E05.mkv' },
        { season: 1, episode: 1, path: '/media/show/S01E01.mkv' },
        { season: 1, episode: 3, path: '/media/show/S01E03.mkv' },
        { season: 1, episode: 2, path: '/media/show/S01E02.mkv' },
        { season: 1, episode: 4, path: '/media/show/S01E04.mkv' },
      ],
    }

    const result = buildSeasonsByRecognizeMediaFilePlan(mm, plan)

    expect(result).toHaveLength(1)
    expect(result[0].episodes).toHaveLength(5)
    expect(result[0].episodes[0].episode.episode_number).toBe(1)
    expect(result[0].episodes[1].episode.episode_number).toBe(2)
    expect(result[0].episodes[2].episode.episode_number).toBe(3)
    expect(result[0].episodes[3].episode.episode_number).toBe(4)
    expect(result[0].episodes[4].episode.episode_number).toBe(5)
  })

  it('sorts seasons by season_number', () => {
    const mediaFolderPath = '/media/show'
    const mm: MediaMetadata = {
      mediaFolderPath,
      files: [
        '/media/show/Season 03/S03E01.mkv',
        '/media/show/Season 01/S01E01.mkv',
        '/media/show/Season 02/S02E01.mkv',
      ],
      tmdbTvShow: {
        id: 1,
        name: 'Show',
        seasons: [] as any,
      } as any,
    }
    const plan = {
      id: 'plan-uuid',
      task: 'recognize-media-file' as const,
      status: 'pending' as const,
      mediaFolderPath,
      files: [
        { season: 3, episode: 1, path: '/media/show/Season 03/S03E01.mkv' },
        { season: 1, episode: 1, path: '/media/show/Season 01/S01E01.mkv' },
        { season: 2, episode: 1, path: '/media/show/Season 02/S02E01.mkv' },
      ],
    }

    const result = buildSeasonsByRecognizeMediaFilePlan(mm, plan)

    expect(result).toHaveLength(3)
    expect(result[0].season.season_number).toBe(1)
    expect(result[1].season.season_number).toBe(2)
    expect(result[2].season.season_number).toBe(3)
  })

  it('handles season 0 (Specials)', () => {
    const mediaFolderPath = '/media/show'
    const videoPath = '/media/show/S00E01.mkv'
    const mm: MediaMetadata = {
      mediaFolderPath,
      files: [videoPath],
      tmdbTvShow: {
        id: 1,
        name: 'Show',
        seasons: [
          { id: 0, season_number: 0, episodes: [{ id: 1, name: 'Special', episode_number: 1, season_number: 0 }] } as any,
        ],
      } as any,
    }
    const plan = {
      id: 'plan-uuid',
      task: 'recognize-media-file' as const,
      status: 'pending' as const,
      mediaFolderPath,
      files: [{ season: 0, episode: 1, path: videoPath }],
    }

    const result = buildSeasonsByRecognizeMediaFilePlan(mm, plan)

    expect(result).toHaveLength(1)
    expect(result[0].season.season_number).toBe(0)
    expect(result[0].episodes[0].episode.episode_number).toBe(1)
  })

  it('includes all video files from plan even if tmdbTvShow has no matching episodes', () => {
    const mediaFolderPath = '/media/show'
    const mm: MediaMetadata = {
      mediaFolderPath,
      files: [
        '/media/show/S01E01.mkv',
        '/media/show/S01E02.mkv',
      ],
      tmdbTvShow: {
        id: 1,
        name: 'Show',
        seasons: [
          { id: 1, season_number: 1, episodes: [] } as any, // No episodes
        ],
      } as any,
    }
    const plan = {
      id: 'plan-uuid',
      task: 'recognize-media-file' as const,
      status: 'pending' as const,
      mediaFolderPath,
      files: [
        { season: 1, episode: 1, path: '/media/show/S01E01.mkv' },
        { season: 1, episode: 2, path: '/media/show/S01E02.mkv' },
      ],
    }

    const result = buildSeasonsByRecognizeMediaFilePlan(mm, plan)

    expect(result).toHaveLength(1)
    expect(result[0].episodes).toHaveLength(2)
    // Both episodes should be created with default values
    expect(result[0].episodes[0].episode.episode_number).toBe(1)
    expect(result[0].episodes[1].episode.episode_number).toBe(2)
    expect(result[0].episodes[0].episode.name).toBe('')
    expect(result[0].episodes[1].episode.name).toBe('')
  })
})

describe('buildSeasonsByRenameFilesPlan', () => {
  it('returns SeasonModel[] with path/newPath when plan has one rename, from is in mm.files, and mm has mediaFiles and tmdbTvShow', () => {
    const mediaFolderPath = '/media/show'
    const fromPath = '/media/show/Season 01/S01E01.mkv'
    const toPath = '/media/show/Season 01/Show - S01E01 - Pilot.mkv'
    const mm: MediaMetadata = {
      mediaFolderPath,
      files: [fromPath],
      mediaFiles: [
        { absolutePath: fromPath, seasonNumber: 1, episodeNumber: 1 },
      ],
      tmdbTvShow: {
        id: 1,
        name: 'Show',
        original_name: '',
        overview: '',
        poster_path: null,
        backdrop_path: null,
        first_air_date: '2024-01-01',
        vote_average: 0,
        vote_count: 0,
        popularity: 0,
        genre_ids: [],
        origin_country: [],
        media_type: 'tv',
        number_of_seasons: 1,
        number_of_episodes: 1,
        seasons: [
          {
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
                name: 'Pilot',
                overview: '',
                still_path: null,
                air_date: '2024-01-01',
                episode_number: 1,
                season_number: 1,
                vote_average: 0,
                vote_count: 0,
                runtime: 42,
              },
            ],
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
    const plan = {
      id: 'plan-uuid',
      task: 'rename-files' as const,
      status: 'pending' as const,
      mediaFolderPath,
      files: [{ from: fromPath, to: toPath }],
    }

    const result = buildSeasonsByRenameFilesPlan(mm, plan)

    expect(result).toHaveLength(1)
    expect(result[0].season.season_number).toBe(1)
    expect(result[0].episodes).toHaveLength(1)
    expect(result[0].episodes[0].episode.episode_number).toBe(1)
    const videoFile = result[0].episodes[0].files.find((f) => f.type === 'video')
    expect(videoFile).toBeDefined()
    expect(videoFile).toMatchObject({ type: 'video', path: fromPath, newPath: toPath })
  })
})

describe('buildSeasonsModelFromMediaMetadata', () => {
  it('should return null when tmdbTvShow is undefined', () => {
    const mediaMetadata: MediaMetadata = {
      mediaFolderPath: '/media/tvshow',
      files: [],
      tmdbTvShow: undefined,
    }

    const result = buildSeasonsModelFromMediaMetadata(mediaMetadata)

    expect(result).toBeNull()
  })

  it('should return empty array when tmdbTvShow has no seasons', () => {
    const mediaMetadata: MediaMetadata = {
      mediaFolderPath: '/media/tvshow',
      files: [],
      tmdbTvShow: {
        id: 1,
        name: 'Show',
        seasons: [],
      } as any,
    }

    const result = buildSeasonsModelFromMediaMetadata(mediaMetadata)

    expect(result).toEqual([])
  })

  it('should build seasons model with one season and one episode', () => {
    const mediaMetadata: MediaMetadata = {
      mediaFolderPath: '/media/tvshow',
      files: [],
      tmdbTvShow: {
        id: 1,
        name: 'Show',
        seasons: [
          {
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
        ],
      } as any,
    }

    const result = buildSeasonsModelFromMediaMetadata(mediaMetadata)

    expect(result).not.toBeNull()
    expect(result).toHaveLength(1)
    expect(result![0].season.season_number).toBe(1)
    expect(result![0].episodes).toHaveLength(1)
    expect(result![0].episodes[0].episode.episode_number).toBe(1)
    expect(result![0].episodes[0].files).toEqual([]) // Files should be empty
  })

  it('should build seasons model with one season and multiple episodes', () => {
    const mediaMetadata: MediaMetadata = {
      mediaFolderPath: '/media/tvshow',
      files: [],
      tmdbTvShow: {
        id: 1,
        name: 'Show',
        seasons: [
          {
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
        ],
      } as any,
    }

    const result = buildSeasonsModelFromMediaMetadata(mediaMetadata)

    expect(result).not.toBeNull()
    expect(result).toHaveLength(1)
    expect(result![0].season.season_number).toBe(1)
    expect(result![0].episodes).toHaveLength(2)
    expect(result![0].episodes[0].episode.episode_number).toBe(1)
    expect(result![0].episodes[1].episode.episode_number).toBe(2)
    expect(result![0].episodes[0].files).toEqual([])
    expect(result![0].episodes[1].files).toEqual([])
  })

  it('should build seasons model with multiple seasons', () => {
    const mediaMetadata: MediaMetadata = {
      mediaFolderPath: '/media/tvshow',
      files: [],
      tmdbTvShow: {
        id: 1,
        name: 'Show',
        seasons: [
          {
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
          {
            id: 2,
            name: 'Season 2',
            overview: '',
            poster_path: null,
            season_number: 2,
            air_date: '2024-07-01',
            episode_count: 1,
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
            ],
          },
        ],
      } as any,
    }

    const result = buildSeasonsModelFromMediaMetadata(mediaMetadata)

    expect(result).not.toBeNull()
    expect(result).toHaveLength(2)
    expect(result![0].season.season_number).toBe(1)
    expect(result![1].season.season_number).toBe(2)
    expect(result![0].episodes).toHaveLength(1)
    expect(result![1].episodes).toHaveLength(1)
  })
})

describe('recognizeMediaFilesByRules', () => {
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

  it('should recognize and assign video files to episodes using lookup function - happy flow', () => {
    const mediaFolderPath = '/media/tvshow'
    const videoFilePath1 = '/media/tvshow/Season 01/Show.Name.S01E01.mkv'
    const videoFilePath2 = '/media/tvshow/Season 01/Show.Name.S01E02.mkv'
    // Subtitle file must have exact same base name as video file for findAssociatedFiles to work
    const subtitleFilePath = '/media/tvshow/Season 01/Show.Name.S01E01.srt'

    const mediaMetadata: MediaMetadata = {
      mediaFolderPath,
      files: [
        videoFilePath1,
        videoFilePath2,
        subtitleFilePath,
      ],
      tmdbTvShow: {
        id: 1,
        name: 'Show Name',
        original_name: 'Show Name',
        overview: '',
        poster_path: null,
        backdrop_path: null,
        first_air_date: '2024-01-01',
        vote_average: 8.5,
        vote_count: 100,
        popularity: 10,
        genre_ids: [],
        origin_country: [],
        media_type: 'tv',
        number_of_seasons: 1,
        number_of_episodes: 2,
        seasons: [
          {
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
        ],
        status: 'Ended',
        type: 'Scripted',
        in_production: false,
        last_air_date: '2024-01-08',
        networks: [],
        production_companies: [],
      },
      mediaFiles: [], // No mediaFiles assigned yet - this triggers the lookup
    }

    // Mock lookup function that returns video file paths based on season/episode numbers
    const lookup = vi.fn((files: string[], seasonNumber: number, episodeNumber: number) => {
      if (seasonNumber === 1 && episodeNumber === 1) {
        return videoFilePath1
      } else if (seasonNumber === 1 && episodeNumber === 2) {
        return videoFilePath2
      }
      return null
    })

    const result = recognizeMediaFilesByRules(mediaMetadata, lookup)

    // Verify the function returns updated seasons
    expect(result).not.toBeNull()
    expect(result).toHaveLength(1)

    // Verify season structure
    expect(result![0].season.season_number).toBe(1)
    expect(result![0].episodes).toHaveLength(2)

    // Verify episode 1 has video file and associated subtitle file assigned
    const episode1 = result![0].episodes[0]
    expect(episode1.episode.episode_number).toBe(1)
    expect(episode1.files).toHaveLength(2) // video + subtitle
    expect(episode1.files.some(f => f.type === 'video' && f.path === videoFilePath1)).toBe(true)
    expect(episode1.files.some(f => f.type === 'subtitle' && f.path === subtitleFilePath)).toBe(true)

    // Verify episode 2 has video file assigned (no associated files)
    const episode2 = result![0].episodes[1]
    expect(episode2.episode.episode_number).toBe(2)
    expect(episode2.files).toHaveLength(1) // only video
    expect(episode2.files.some(f => f.type === 'video' && f.path === videoFilePath2)).toBe(true)

    // Verify lookup was called for both episodes
    expect(lookup).toHaveBeenCalledTimes(2)
    expect(lookup).toHaveBeenCalledWith(mediaMetadata.files, 1, 1)
    expect(lookup).toHaveBeenCalledWith(mediaMetadata.files, 1, 2)

    // Verify console logs for debugging
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[TvShowPanelUtils] built seasons model from tmdbTvShow:',
      expect.any(Array)
    )
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[TvShowPanelUtils] video file path from lookup:',
      expect.any(String)
    )
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[TvShowPanelUtils] updating episode files:',
      expect.any(Array),
      expect.any(Array)
    )
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[TvShowPanelUtils] seasons for preview:',
      expect.any(Array)
    )
  })

  it('should return null when mediaMetadata is null', () => {
    const result = recognizeMediaFilesByRules(null as any, vi.fn())
    expect(result).toBeNull()
  })

  it('should return null when mediaMetadata.mediaFolderPath is undefined', () => {
    const mediaMetadata: MediaMetadata = {
      mediaFolderPath: undefined,
      files: [],
      tmdbTvShow: {} as any,
    }
    const result = recognizeMediaFilesByRules(mediaMetadata, vi.fn())
    expect(result).toBeNull()
  })

  it('should return null when mediaMetadata.files is undefined', () => {
    const mediaMetadata: MediaMetadata = {
      mediaFolderPath: '/media/tvshow',
      files: undefined,
      tmdbTvShow: {} as any,
    }
    const result = recognizeMediaFilesByRules(mediaMetadata, vi.fn())
    expect(result).toBeNull()
  })

  it('should return null when tmdbTvShow is undefined', () => {
    const mediaMetadata: MediaMetadata = {
      mediaFolderPath: '/media/tvshow',
      files: [],
      tmdbTvShow: undefined,
    }
    const result = recognizeMediaFilesByRules(mediaMetadata, vi.fn())
    expect(result).toBeNull()
  })

  it('should always call lookup regardless of existing mediaFiles', () => {
    const mediaFolderPath = '/media/tvshow'
    const videoFilePath = '/media/tvshow/Show.Name.S01E01.mkv'

    const mediaMetadata: MediaMetadata = {
      mediaFolderPath,
      files: [videoFilePath],
      tmdbTvShow: {
        id: 1,
        name: 'Show',
        seasons: [
          {
            id: 1,
            season_number: 1,
            episodes: [
              { id: 101, name: 'Ep 1', episode_number: 1, season_number: 1 },
            ],
          } as any,
        ],
      } as any,
      // Even though mediaFile exists, lookup should still be called
      mediaFiles: [
        { absolutePath: videoFilePath, seasonNumber: 1, episodeNumber: 1 },
      ],
    }

    const lookup = vi.fn(() => videoFilePath)

    const result = recognizeMediaFilesByRules(mediaMetadata, lookup)

    // Verify the season is returned and lookup was called
    expect(result).not.toBeNull()
    expect(result![0].episodes[0].files).toHaveLength(1)
    expect(result![0].episodes[0].files[0].path).toBe(videoFilePath)
    expect(lookup).toHaveBeenCalledWith(mediaMetadata.files, 1, 1)

    // Verify console log for lookup result
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[TvShowPanelUtils] video file path from lookup:',
      videoFilePath
    )
  })

  it('should handle episodes where lookup returns null', () => {
    const mediaFolderPath = '/media/tvshow'

    const mediaMetadata: MediaMetadata = {
      mediaFolderPath,
      files: [],
      tmdbTvShow: {
        id: 1,
        name: 'Show',
        seasons: [
          {
            id: 1,
            season_number: 1,
            episodes: [
              { id: 101, name: 'Ep 1', episode_number: 1, season_number: 1 },
            ],
          } as any,
        ],
      } as any,
      mediaFiles: [], // No mediaFiles assigned
    }

    // Mock lookup that returns null (file not found)
    const lookup = vi.fn(() => null)

    const result = recognizeMediaFilesByRules(mediaMetadata, lookup)

    // Verify the season is returned but episode has no files
    expect(result).not.toBeNull()
    expect(result![0].episodes[0].files).toHaveLength(0)
    expect(lookup).toHaveBeenCalledWith(mediaMetadata.files, 1, 1)
  })

  it('should override outdated mediaFiles with lookup result', () => {
    const mediaFolderPath = '/media/tvshow'
    const wrongFilePath = '/media/tvshow/wrong_file.mp4'
    const correctFilePath = '/media/tvshow/Season 01/Show.Name.S01E01.mkv'

    const mediaMetadata: MediaMetadata = {
      mediaFolderPath,
      files: [correctFilePath, wrongFilePath],
      tmdbTvShow: {
        id: 1,
        name: 'Show',
        seasons: [
          {
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
        ],
      } as any,
      // mediaFiles contains outdated/wrong file for S01E01
      mediaFiles: [
        { absolutePath: wrongFilePath, seasonNumber: 1, episodeNumber: 1 },
      ],
    }

    // Mock lookup that returns the correct file (overrides the outdated mediaFile)
    const lookup = vi.fn(() => correctFilePath)

    const result = recognizeMediaFilesByRules(mediaMetadata, lookup)

    // Verify the season is returned with the correct file from lookup
    expect(result).not.toBeNull()
    expect(result![0].episodes[0].files).toHaveLength(1)
    expect(result![0].episodes[0].files[0].path).toBe(correctFilePath)
    expect(result![0].episodes[0].files[0].path).not.toBe(wrongFilePath)

    // Verify lookup was called (even though mediaFile existed)
    expect(lookup).toHaveBeenCalledWith(mediaMetadata.files, 1, 1)

    // Verify console log for lookup result
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[TvShowPanelUtils] video file path from lookup:',
      correctFilePath
    )
  })
})
