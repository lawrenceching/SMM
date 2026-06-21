import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mapTagToFileType, newPath, buildFileProps, renameFiles, updateMediaFileMetadatas, buildTvShowMediaMetadataByNFO, buildTmdbEpisodeByNFO, buildTemporaryRecognitionPlanAsync, tryToRecognizeTvShowFolderByNFO, unlinkEpisode, handlePendingPlans } from './TvShowPanelUtils'
import type { FileProps } from '@/lib/types'
import type { MediaMetadata, MediaFileMetadata } from '@core/types'
import type { UIMediaMetadata } from '@/types/UIMediaMetadata'
import { readFile } from '@/api/readFile'
import { parseEpisodeNfo } from '@/lib/nfo'
import { toast } from 'sonner'

vi.mock('@/api/readFile')
vi.mock('@/lib/nfo')
vi.mock('@/ai/tools/EndRecognizeTask', () => ({
  cleanupRecognizePlan: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/lib/recognizeEpisodes', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/recognizeEpisodes')>()
  return {
    ...mod,
    recognizeEpisodesAsync: vi.fn((mm: Parameters<typeof mod.recognizeEpisodes>[0]) =>
      Promise.resolve(mod.recognizeEpisodes(mm))
    ),
  }
})
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

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
    
    // getFullExtensionForAssociatedFile preserves one modifier, so .en.srt stays .en.srt
    expect(result).toBe('/media/tvshow/season1/episode1_new.en.srt')
  })

  it('should handle nested directory structures', () => {
    const mediaFolderPath = '/media/tvshow'
    const videoFilePath = '/media/tvshow/Season 01/Episode 01_new.mkv'
    const associatedFilePath = '/media/tvshow/Season 01/Episode 01.en.srt'
    
    const result = newPath(mediaFolderPath, videoFilePath, associatedFilePath)
    
    // getFullExtensionForAssociatedFile preserves one modifier, so .en.srt stays .en.srt
    expect(result).toBe('/media/tvshow/Season 01/Episode 01_new.en.srt')
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
  const createMockMediaMetadata = (overrides?: Partial<MediaMetadata>): UIMediaMetadata => ({
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
    status: 'ok',
    ...overrides,
  } as UIMediaMetadata)

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

    // getFullExtensionForAssociatedFile preserves one modifier before base ext; .en.forced.srt → .forced.srt
    expect(result[1].newPath).toBe('/media/tvshow/season1/episode1_new.forced.srt')
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

describe('buildTvShowMediaMetadataByNFO', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  const minimalTvShow = (inner: string) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<tvshow>
${inner}
</tvshow>`

  it('returns undefined for malformed XML', () => {
    const invalid = `<?xml version="1.0"?>
<tvshow>
  <title>Test</title>
  <unclosed>
</tvshow>`
    expect(buildTvShowMediaMetadataByNFO(invalid)).toBeUndefined()
    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  it('returns undefined when tvshow root is missing', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<episodedetails>
  <title>Only Episode</title>
</episodedetails>`
    expect(buildTvShowMediaMetadataByNFO(xml)).toBeUndefined()
  })

  it('returns undefined when no TMDB or TVDB id can be resolved', () => {
    const xml = minimalTvShow(`  <title>No Ids</title>
`)
    expect(buildTvShowMediaMetadataByNFO(xml)).toBeUndefined()
  })

  it('prefers TMDB when both TMDB and TVDB ids exist', () => {
    const xml = minimalTvShow(`  <title>Komi</title>
  <uniqueid type="tmdb">123876</uniqueid>
  <uniqueid default="true" type="tvdb">402412</uniqueid>
`)
    const mm = buildTvShowMediaMetadataByNFO(xml)
    expect(mm).toEqual({
      id: '123876',
      name: 'Komi',
      database: 'TMDB',
      seasons: [],
    })
  })

  it('uses TVDB when only TVDB uniqueid is present', () => {
    const xml = minimalTvShow(`  <title>TVDB Show</title>
  <uniqueid default="true" type="tvdb">402412</uniqueid>
`)
    expect(buildTvShowMediaMetadataByNFO(xml)).toEqual({
      id: '402412',
      name: 'TVDB Show',
      database: 'TVDB',
      seasons: [],
    })
  })

  it('prefers uniqueid tvdb with default=true over non-default tvdb', () => {
    const xml = minimalTvShow(`  <title>Pick Default</title>
  <uniqueid type="tvdb">999</uniqueid>
  <uniqueid default="true" type="tvdb">402412</uniqueid>
`)
    const mm = buildTvShowMediaMetadataByNFO(xml)
    expect(mm?.id).toBe('402412')
    expect(mm?.database).toBe('TVDB')
  })

  it('reads TMDB id from tmdbid when uniqueid type tmdb is absent', () => {
    const xml = minimalTvShow(`  <title>From tmdbid</title>
  <tmdbid>555</tmdbid>
`)
    expect(buildTvShowMediaMetadataByNFO(xml)).toMatchObject({
      id: '555',
      database: 'TMDB',
      name: 'From tmdbid',
    })
  })

  it('reads TMDB id from episodeguide JSON when no other TMDB source', () => {
    const xml = minimalTvShow(`  <title>EG TMDB</title>
  <episodeguide>{"tmdb":"777"}</episodeguide>
`)
    expect(buildTvShowMediaMetadataByNFO(xml)).toMatchObject({
      id: '777',
      database: 'TMDB',
      name: 'EG TMDB',
    })
  })

  it('reads TVDB id from episodeguide when TMDB is absent', () => {
    const xml = minimalTvShow(`  <title>EG TVDB</title>
  <episodeguide>{"tvdb":"888","imdb":"tt000"}</episodeguide>
`)
    expect(buildTvShowMediaMetadataByNFO(xml)).toMatchObject({
      id: '888',
      database: 'TVDB',
      name: 'EG TVDB',
    })
  })

  it('uses id element as TMDB fallback when structured ids are zero', () => {
    const xml = minimalTvShow(`  <title>Raw Id</title>
  <id>333</id>
`)
    expect(buildTvShowMediaMetadataByNFO(xml)).toMatchObject({
      id: '333',
      database: 'TMDB',
      name: 'Raw Id',
    })
  })

  it('does not use id as TMDB when TVDB is already resolved', () => {
    const xml = minimalTvShow(`  <title>Mixed</title>
  <uniqueid default="true" type="tvdb">100</uniqueid>
  <id>99999</id>
`)
    const mm = buildTvShowMediaMetadataByNFO(xml)
    expect(mm?.database).toBe('TVDB')
    expect(mm?.id).toBe('100')
  })

  it('uses empty string for name when title is missing', () => {
    const xml = minimalTvShow(`  <uniqueid type="tmdb">1</uniqueid>
`)
    expect(buildTvShowMediaMetadataByNFO(xml)).toMatchObject({
      id: '1',
      name: '',
      database: 'TMDB',
      seasons: [],
    })
  })

  it('parses real-world TinyMediaManager tvshow.nfo shape', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<tvshow>
  <title>古见同学有交流障碍症</title>
  <episodeguide>{"tmdb":"123876","tvdb":"402412"}</episodeguide>
  <id>402412</id>
  <tmdbid>123876</tmdbid>
  <uniqueid default="false" type="tmdb">123876</uniqueid>
  <uniqueid default="true" type="tvdb">402412</uniqueid>
</tvshow>`
    expect(buildTvShowMediaMetadataByNFO(xml)).toEqual({
      id: '123876',
      name: '古见同学有交流障碍症',
      database: 'TMDB',
      seasons: [],
    })
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

describe('buildTemporaryRecognitionPlanAsync', () => {
  const tvShowWithS1E1 = {
    id: '1',
    name: 'Show',
    database: 'TMDB' as const,
    seasons: [
      {
        season: 1,
        name: '',
        episodes: [{ season: 1, episode: 1, name: '' }],
      },
    ],
  }

  it('returns null when mediaFolderPath is missing', async () => {
    const mm: MediaMetadata = {
      mediaFolderPath: undefined,
      files: ['/media/S01E01.mkv'],
      tvShow: tvShowWithS1E1,
    }
    const result = await buildTemporaryRecognitionPlanAsync(mm)
    expect(result).toBeNull()
  })

  it('returns null when files is missing', async () => {
    const mm: MediaMetadata = {
      mediaFolderPath: '/media',
      files: undefined,
      tvShow: tvShowWithS1E1,
    }
    const result = await buildTemporaryRecognitionPlanAsync(mm)
    expect(result).toBeNull()
  })

  it('returns null when tvShow is missing', async () => {
    const mm: MediaMetadata = {
      mediaFolderPath: '/media',
      files: ['/media/S01E01.mkv'],
      tvShow: undefined,
    }
    const result = await buildTemporaryRecognitionPlanAsync(mm)
    expect(result).toBeNull()
  })

  it('returns plan with empty files when no files are recognized', async () => {
    const mm: MediaMetadata = {
      mediaFolderPath: '/media',
      files: ['/media/other.mkv'],
      tvShow: {
        id: '1',
        name: 'Show',
        database: 'TMDB',
        seasons: [{ season: 1, name: '', episodes: [{ season: 1, episode: 1, name: '' }] }],
      },
    }
    const result = await buildTemporaryRecognitionPlanAsync(mm)
    expect(result).not.toBeNull()
    expect(result!.mediaFolderPath).toBe('/media')
    expect(result!.files).toHaveLength(0)
  })

  it('returns plan with files and mediaFolderPath when recognizeEpisodes returns matches', async () => {
    const mediaFolderPath = '/media/show'
    const mm: MediaMetadata = {
      mediaFolderPath,
      files: ['/media/show/S01E01.mkv', '/media/show/S01E02.mkv'],
      tvShow: {
        id: '1',
        name: 'Show',
        database: 'TMDB',
        seasons: [
          {
            season: 1,
            name: '',
            episodes: [
              { season: 1, episode: 1, name: '' },
              { season: 1, episode: 2, name: '' },
            ],
          },
        ],
      },
    }
    const result = await buildTemporaryRecognitionPlanAsync(mm)
    expect(result).not.toBeNull()
    expect(result!.mediaFolderPath).toBe(mediaFolderPath)
    expect(result!.files).toHaveLength(2)
    expect(result!.files).toContainEqual({ season: 1, episode: 1, path: '/media/show/S01E01.mkv' })
    expect(result!.files).toContainEqual({ season: 1, episode: 2, path: '/media/show/S01E02.mkv' })
  })
})


describe('tryToRecognizeTvShowFolderByNFO', () => {
  it('should handle parseEpisodeNfo error and return mediaMetadata with valid tvShow', async () => {
    const tvshowNfoXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<tvshow>
  <title>Test Show</title>
  <originaltitle>Original Test Show</originaltitle>
  <plot>This is a test show description</plot>
  <id>12345</id>
  <tmdbid>54321</tmdbid>
  <uniqueid type="tmdb">99999</uniqueid>
  <premiered>2024-01-01</premiered>
  <status>Continuing</status>
  <genre>Drama</genre>
</tvshow>`

    const episodeNfoXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<episodedetails>
  <title>Episode 1</title>
  <season>1</season>
  <episode>1</episode>
  <originalfilename>episode1.mkv</originalfilename>
</episodedetails>`

    const mediaMetadata: UIMediaMetadata = {
      mediaFolderPath: '/media/testshow',
      files: [
        '/media/testshow/tvshow.nfo',
        '/media/testshow/episode1.nfo',
        '/media/testshow/episode1.mkv',
      ],
      mediaFiles: [],
      status: 'ok',
    }

    vi.mocked(readFile)
      .mockResolvedValueOnce({ data: tvshowNfoXml, error: undefined })
      .mockResolvedValueOnce({ data: episodeNfoXml, error: undefined })

    vi.mocked(parseEpisodeNfo).mockRejectedValueOnce(new Error('Parse error'))

    const result = await tryToRecognizeTvShowFolderByNFO(mediaMetadata)

    expect(result).toBeDefined()
    expect(result?.tvShow).toEqual({
      id: '99999',
      name: 'Test Show',
      database: 'TMDB',
      seasons: [],
    })
  })
})

describe('unlinkEpisode', () => {
  const mockUpdateMediaMetadata = vi.fn()
  const mockT = vi.fn((key: string) => key)

  beforeEach(() => {
    mockUpdateMediaMetadata.mockReset()
    mockT.mockImplementation((key: string) => key)
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
  })

  const createMediaMetadata = (mediaFiles: Array<{ seasonNumber: number; episodeNumber: number; absolutePath?: string }>) => ({
    mediaFolderPath: '/show/season1',
    status: 'ok' as const,
    mediaFiles: mediaFiles.map((mf, i) => ({
      seasonNumber: mf.seasonNumber,
      episodeNumber: mf.episodeNumber,
      absolutePath: mf.absolutePath ?? `/show/season1/ep${i + 1}.mkv`,
    })),
  } as UIMediaMetadata)

  it('does nothing when mediaMetadata is undefined', () => {
    unlinkEpisode({
      season: 1,
      episode: 1,
      mediaMetadata: undefined,
      updateMediaMetadata: mockUpdateMediaMetadata,
      t: mockT,
    })
    expect(mockUpdateMediaMetadata).not.toHaveBeenCalled()
  })

  it('does nothing when mediaFolderPath is undefined', () => {
    unlinkEpisode({
      season: 1,
      episode: 1,
      mediaMetadata: { ...createMediaMetadata([{ seasonNumber: 1, episodeNumber: 1 }]), mediaFolderPath: undefined },
      updateMediaMetadata: mockUpdateMediaMetadata,
      t: mockT,
    })
    expect(mockUpdateMediaMetadata).not.toHaveBeenCalled()
  })

  it('does nothing when mediaFiles is undefined', () => {
    unlinkEpisode({
      season: 1,
      episode: 1,
      mediaMetadata: { mediaFolderPath: '/show', status: 'ok', mediaFiles: undefined } as UIMediaMetadata,
      updateMediaMetadata: mockUpdateMediaMetadata,
      t: mockT,
    })
    expect(mockUpdateMediaMetadata).not.toHaveBeenCalled()
  })

  it('calls updateMediaMetadata with path, updated metadata without the episode, and traceId', () => {
    mockUpdateMediaMetadata.mockResolvedValue(undefined)
    const mediaMetadata = createMediaMetadata([
      { seasonNumber: 1, episodeNumber: 1 },
      { seasonNumber: 1, episodeNumber: 2 },
      { seasonNumber: 1, episodeNumber: 3 },
    ])
    unlinkEpisode({
      season: 1,
      episode: 2,
      mediaMetadata,
      updateMediaMetadata: mockUpdateMediaMetadata,
      t: mockT,
    })
    expect(mockUpdateMediaMetadata).toHaveBeenCalledTimes(1)
    const [path, metadata, options] = mockUpdateMediaMetadata.mock.calls[0]
    expect(path).toBe('/show/season1')
    expect(metadata).toMatchObject({
      mediaFolderPath: '/show/season1',
      mediaFiles: [
        expect.objectContaining({ seasonNumber: 1, episodeNumber: 1 }),
        expect.objectContaining({ seasonNumber: 1, episodeNumber: 3 }),
      ],
    })
    expect(metadata.mediaFiles).toHaveLength(2)
    expect(options).toMatchObject({ traceId: expect.stringMatching(/^TvShowPanel-unlinkEpisode-/) })
  })

  it('on success calls toast.success with unlinkSuccess i18n key', async () => {
    mockUpdateMediaMetadata.mockResolvedValue(undefined)
    const mediaMetadata = createMediaMetadata([{ seasonNumber: 1, episodeNumber: 1 }])
    unlinkEpisode({
      season: 1,
      episode: 1,
      mediaMetadata,
      updateMediaMetadata: mockUpdateMediaMetadata,
      t: mockT,
    })
    await mockUpdateMediaMetadata.mock.results[0]?.value
    expect(toast.success).toHaveBeenCalledWith('tvShowEpisodeTable.unlinkSuccess')
  })

  it('on updateMediaMetadata reject calls toast.error with unlinkFailed i18n key', async () => {
    mockUpdateMediaMetadata.mockRejectedValue(new Error('persist failed'))
    const mediaMetadata = createMediaMetadata([{ seasonNumber: 1, episodeNumber: 1 }])
    unlinkEpisode({
      season: 1,
      episode: 1,
      mediaMetadata,
      updateMediaMetadata: mockUpdateMediaMetadata,
      t: mockT,
    })
    const updatePromise = mockUpdateMediaMetadata.mock.results[0]?.value as Promise<unknown>
    await expect(updatePromise).rejects.toThrow('persist failed')
    await Promise.resolve() // flush microtask queue so .catch() runs
    expect(toast.error).toHaveBeenCalledWith('tvShowEpisodeTable.unlinkFailed')
  })

  it('filters out the single matching episode when only one exists', () => {
    mockUpdateMediaMetadata.mockResolvedValue(undefined)
    const mediaMetadata = createMediaMetadata([{ seasonNumber: 2, episodeNumber: 5 }])
    unlinkEpisode({
      season: 2,
      episode: 5,
      mediaMetadata,
      updateMediaMetadata: mockUpdateMediaMetadata,
      t: mockT,
    })
    const [, metadata] = mockUpdateMediaMetadata.mock.calls[0]
    expect(metadata.mediaFiles).toHaveLength(0)
  })
})

describe('handlePendingPlans', () => {
  // Regression: cancelling a backend-persisted plan must invoke the injected
  // updatePlan with 'rejected' so the backend plan file stops being returned
  // by the plans query. Without this the AiBasedRecognizePrompt reopens on the
  // next plans refetch / folder switch.
  const baseMediaMetadata = {
    mediaFolderPath: '/media/tvshow',
    type: 'tvshow-folder' as const,
    status: 'ok' as const,
  }

  const basePlan = {
    id: 'plan-1',
    task: 'recognize-media-file' as const,
    status: 'pending' as const,
    creator: 'app' as const,
    mediaFolderPath: '/media/tvshow',
    files: [],
  }

  const makeParams = (overrides?: {
    plan?: Parameters<typeof handlePendingPlans>[0]['pendingPlans'][number]
    updatePlan?: ReturnType<typeof vi.fn>
    isAiFeatureEnabled?: boolean
  }) => {
    const updatePlan = overrides?.updatePlan ?? vi.fn(() => Promise.resolve())
    const openAi = vi.fn()
    const params = {
      pendingPlans: [overrides?.plan ?? basePlan],
      mediaMetadata: baseMediaMetadata as never,
      openAiBasedRecognizePrompt: openAi,
      closeAiBasedRecognizePrompt: vi.fn(),
      handleAiRecognizeConfirmCallback: vi.fn(),
      updatePlan,
      toast,
      isAiFeatureEnabled: overrides?.isAiFeatureEnabled ?? true,
    }
    return { params, openAi, updatePlan }
  }

  it('does NOT open the AI prompt for a rule-based (app) plan; closes it instead', () => {
    // Rule-based plans are owned by RuleBasedRecognizePrompt. Surfacing them via
    // the AI prompt is what made the prompt "reappear" after cancel.
    const closeAi = vi.fn()
    const { params, openAi } = makeParams()
    handlePendingPlans({ ...params, closeAiBasedRecognizePrompt: closeAi })
    expect(openAi).not.toHaveBeenCalled()
    expect(closeAi).toHaveBeenCalledTimes(1)
  })

  it('cancel of an AI-created plan calls updatePlan with rejected exactly once', async () => {
    const { params, openAi, updatePlan } = makeParams({
      plan: { ...basePlan, creator: 'ai' as const },
    })
    handlePendingPlans(params)
    const config = openAi.mock.calls[0]?.[0] as { onCancel?: () => Promise<void> }
    expect(config.onCancel).toBeDefined()
    await config.onCancel!()
    expect(updatePlan).toHaveBeenCalledTimes(1)
    expect(updatePlan).toHaveBeenCalledWith('plan-1', 'rejected')
  })

  it('skips opening the prompt when AI features are disabled', () => {
    const { params, openAi } = makeParams({ isAiFeatureEnabled: false })
    handlePendingPlans(params)
    expect(openAi).not.toHaveBeenCalled()
  })
})
