import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MediaMetadataRepository } from './mediaMetadataRepository'
import type { MediaMetadata } from '@core/types'
import type { UIMediaMetadata } from '@/types/UIMediaMetadata'

vi.mock('./readMediaMetadataV2', () => ({
  readMediaMetadataV2: vi.fn(),
  metadataCacheFilePath: vi.fn(),
}))

vi.mock('./writeMediaMetadata', () => ({
  writeMediaMetadata: vi.fn(),
}))

vi.mock('./deleteMediaMetadata', () => ({
  deleteMediaMetadata: vi.fn(),
}))

vi.mock('./listFiles', () => ({
  listFiles: vi.fn(),
}))

vi.mock('@/lib/mediaMetadataRefreshUtils', () => ({
  mergeRefreshedMetadata: vi.fn(),
}))

import { readMediaMetadataV2 } from './readMediaMetadataV2'
import { writeMediaMetadata } from './writeMediaMetadata'
import { deleteMediaMetadata } from './deleteMediaMetadata'
import { listFiles } from './listFiles'
import { mergeRefreshedMetadata } from '@/lib/mediaMetadataRefreshUtils'

const mockReadMediaMetadataV2 = readMediaMetadataV2 as ReturnType<typeof vi.fn>
const mockWriteMediaMetadata = writeMediaMetadata as ReturnType<typeof vi.fn>
const mockDeleteMediaMetadata = deleteMediaMetadata as ReturnType<typeof vi.fn>
const mockListFiles = listFiles as ReturnType<typeof vi.fn>
const mockMergeRefreshedMetadata = mergeRefreshedMetadata as ReturnType<typeof vi.fn>

const createMockMediaMetadata = (overrides?: Partial<MediaMetadata>): MediaMetadata => ({
  mediaFolderPath: '/media/show1',
  type: 'tvshow-folder',
  mediaName: 'Show 1',
  files: ['/media/show1/episode1.mp4'],
  mediaFiles: [],
  ...overrides,
} as MediaMetadata)

const createMockUIMediaMetadata = (overrides?: Partial<UIMediaMetadata>): UIMediaMetadata => ({
  ...createMockMediaMetadata(overrides),
  status: 'idle',
} as UIMediaMetadata)

describe('MediaMetadataRepository', () => {
  let repository: MediaMetadataRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repository = new MediaMetadataRepository()
  })

  describe('read', () => {
    it('should read media metadata from cache', async () => {
      const mockMetadata = createMockMediaMetadata()
      mockReadMediaMetadataV2.mockResolvedValue(mockMetadata)

      const result = await repository.read('/media/show1')

      expect(mockReadMediaMetadataV2).toHaveBeenCalledWith('/media/show1', {})
      expect(result).toEqual(mockMetadata)
    })

    it('should pass traceId to read function', async () => {
      const mockMetadata = createMockMediaMetadata()
      mockReadMediaMetadataV2.mockResolvedValue(mockMetadata)

      await repository.read('/media/show1', { traceId: 'test-trace' })

      expect(mockReadMediaMetadataV2).toHaveBeenCalledWith('/media/show1', { traceId: 'test-trace' })
    })
  })

  describe('write', () => {
    it('should write media metadata to cache', async () => {
      const mockMetadata = createMockUIMediaMetadata()
      mockWriteMediaMetadata.mockResolvedValue(undefined)

      await repository.write(mockMetadata)

      expect(mockWriteMediaMetadata).toHaveBeenCalledWith(mockMetadata, {})
    })

    it('should pass traceId to write function', async () => {
      const mockMetadata = createMockUIMediaMetadata()
      mockWriteMediaMetadata.mockResolvedValue(undefined)

      await repository.write(mockMetadata, { traceId: 'test-trace' })

      expect(mockWriteMediaMetadata).toHaveBeenCalledWith(mockMetadata, { traceId: 'test-trace' })
    })
  })

  describe('delete', () => {
    it('should delete media metadata from cache', async () => {
      mockDeleteMediaMetadata.mockResolvedValue(undefined)

      await repository.delete('/media/show1')

      expect(mockDeleteMediaMetadata).toHaveBeenCalledWith('/media/show1')
    })
  })

  describe('refresh', () => {
    it('should refresh metadata by reading and merging', async () => {
      const currentMetadata = createMockUIMediaMetadata({ status: 'ok' })
      const refreshedMetadata = createMockMediaMetadata({ mediaName: 'Updated Show' })
      const mergedMetadata = createMockUIMediaMetadata({ mediaName: 'Updated Show', status: 'ok' })

      mockReadMediaMetadataV2.mockResolvedValue(refreshedMetadata)
      mockMergeRefreshedMetadata.mockReturnValue(mergedMetadata)

      const result = await repository.refresh('/media/show1', currentMetadata)

      expect(mockReadMediaMetadataV2).toHaveBeenCalledWith('/media/show1', {})
      expect(mockMergeRefreshedMetadata).toHaveBeenCalledWith(refreshedMetadata, currentMetadata)
      expect(result).toEqual(mergedMetadata)
    })

    it('should handle undefined current metadata', async () => {
      const refreshedMetadata = createMockMediaMetadata()
      const mergedMetadata = createMockUIMediaMetadata({ status: 'idle' })

      mockReadMediaMetadataV2.mockResolvedValue(refreshedMetadata)
      mockMergeRefreshedMetadata.mockReturnValue(mergedMetadata)

      const result = await repository.refresh('/media/show1', undefined)

      expect(mockMergeRefreshedMetadata).toHaveBeenCalledWith(refreshedMetadata, undefined)
      expect(result).toEqual(mergedMetadata)
    })
  })

  describe('reloadAll', () => {
    it('should reload all metadata for given folders', async () => {
      const folders = ['/media/show1', '/media/show2']
      const currentMap = new Map([
        ['/media/show1', createMockUIMediaMetadata()],
        ['/media/show2', createMockUIMediaMetadata()],
      ])
      const refreshed1 = createMockMediaMetadata({ mediaName: 'Show 1 Updated' })
      const refreshed2 = createMockMediaMetadata({ mediaName: 'Show 2 Updated' })
      const merged1 = createMockUIMediaMetadata({ mediaName: 'Show 1 Updated' })
      const merged2 = createMockUIMediaMetadata({ mediaName: 'Show 2 Updated' })

      mockReadMediaMetadataV2
        .mockResolvedValueOnce(refreshed1)
        .mockResolvedValueOnce(refreshed2)
      mockMergeRefreshedMetadata
        .mockReturnValueOnce(merged1)
        .mockReturnValueOnce(merged2)

      const result = await repository.reloadAll(folders, currentMap)

      expect(result).toEqual([merged1, merged2])
      expect(mockReadMediaMetadataV2).toHaveBeenCalledTimes(2)
      expect(mockMergeRefreshedMetadata).toHaveBeenCalledTimes(2)
    })
  })

  describe('initialize', () => {
    it('should initialize metadata for a folder', async () => {
      // Mock read to throw error (no existing metadata)
      mockReadMediaMetadataV2.mockRejectedValue(new Error('File not found'))

      // Mock listFiles to return some files
      mockListFiles.mockResolvedValue({
        data: {
          items: [
            { path: '/media/show1/episode1.mp4', isDirectory: false },
            { path: '/media/show1/episode2.mp4', isDirectory: false },
          ]
        }
      })

      const result = await repository.initialize('/media/show1', 'tvshow-folder')
      expect(result).toBeDefined()
      expect(result.mediaFolderPath).toBe('/media/show1')
      expect(result.type).toBe('tvshow-folder')
      expect(result.status).toBe('initializing')
      expect(result.files).toEqual(['/media/show1/episode1.mp4', '/media/show1/episode2.mp4'])
    })
  })
})