import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMediaMetadataActions } from './mediaMetadataActions'
import type { UIMediaMetadata } from '@/types/UIMediaMetadata'

vi.mock('@/api/mediaMetadataRepository', () => ({
  mediaMetadataRepository: {
    read: vi.fn(),
    write: vi.fn(),
    delete: vi.fn(),
    refresh: vi.fn(),
    reloadAll: vi.fn(),
    initialize: vi.fn(),
  },
}))

vi.mock('@/lib/uiDomainMapper', () => ({
  hasDomainMetadataChanged: vi.fn(),
  extractPersistableMediaMetadata: vi.fn(),
}))

vi.mock('@/stores/mediaMetadataStore', () => ({
  useMediaMetadataStoreActions: vi.fn(),
  useMediaMetadataStoreState: vi.fn(() => ({ mediaMetadatas: [] })),
}))

vi.mock('@/lib/utils', () => ({
  nextTraceId: vi.fn(),
}))

import { mediaMetadataRepository } from '@/api/mediaMetadataRepository'
import { hasDomainMetadataChanged } from '@/lib/uiDomainMapper'
import { useMediaMetadataStoreActions } from '@/stores/mediaMetadataStore'
import { nextTraceId } from '@/lib/utils'

const mockRepository = mediaMetadataRepository as any
const mockHasDomainMetadataChanged = hasDomainMetadataChanged as ReturnType<typeof vi.fn>
const mockUseMediaMetadataStoreActions = useMediaMetadataStoreActions as ReturnType<typeof vi.fn>
const mockNextTraceId = nextTraceId as ReturnType<typeof vi.fn>

const createMockUIMediaMetadata = (overrides?: Partial<UIMediaMetadata>): UIMediaMetadata => ({
  mediaFolderPath: '/media/show1',
  type: 'tvshow-folder',
  status: 'idle',
  mediaName: 'Show 1',
  files: [],
  mediaFiles: [],
  ...overrides,
} as UIMediaMetadata)

describe('MediaMetadataActions', () => {
  let mockStoreActions: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockStoreActions = {
      setMediaMetadatas: vi.fn(),
      addMediaMetadata: vi.fn(),
      updateMediaMetadata: vi.fn(),
      removeMediaMetadata: vi.fn(),
      getMediaMetadata: vi.fn(),
    }
    mockUseMediaMetadataStoreActions.mockReturnValue(mockStoreActions)
    mockNextTraceId.mockReturnValue('test-trace-id')
  })

  describe('saveMediaMetadata', () => {
    it('should save metadata and update store', async () => {
      const { result } = renderHook(() => useMediaMetadataActions())
      const mockMetadata = createMockUIMediaMetadata()

      mockRepository.write.mockResolvedValue(undefined)

      await act(async () => {
        await result.current.saveMediaMetadata(mockMetadata)
      })

      expect(mockRepository.write).toHaveBeenCalledWith(mockMetadata, { traceId: 'saveMediaMetadata-test-trace-id' })
      expect(mockStoreActions.addMediaMetadata).toHaveBeenCalledWith(mockMetadata)
    })

    it('should handle errors', async () => {
      const { result } = renderHook(() => useMediaMetadataActions())
      const mockMetadata = createMockUIMediaMetadata()
      const error = new Error('Save failed')

      mockRepository.write.mockRejectedValue(error)

      await expect(act(async () => {
        await result.current.saveMediaMetadata(mockMetadata)
      })).rejects.toThrow('Save failed')
    })
  })

  describe('updateMediaMetadata', () => {
    it('should update metadata when domain changes', async () => {
      const { result } = renderHook(() => useMediaMetadataActions())
      const currentMetadata = createMockUIMediaMetadata({ mediaName: 'Old Name' })
      const updatedMetadata = createMockUIMediaMetadata({ mediaName: 'New Name' })

      mockStoreActions.getMediaMetadata.mockReturnValue(currentMetadata)
      mockHasDomainMetadataChanged.mockReturnValue(true)
      mockRepository.write.mockResolvedValue(undefined)

      await act(async () => {
        await result.current.updateMediaMetadata('/media/show1', updatedMetadata)
      })

      expect(mockRepository.write).toHaveBeenCalledWith(updatedMetadata, { traceId: 'updateMediaMetadata-test-trace-id' })
      expect(mockStoreActions.updateMediaMetadata).toHaveBeenCalledWith('/media/show1', expect.any(Function))
    })

    it('should only update UI when domain does not change', async () => {
      const { result } = renderHook(() => useMediaMetadataActions())
      const currentMetadata = createMockUIMediaMetadata({ status: 'idle' })
      const updatedMetadata = createMockUIMediaMetadata({ status: 'loading' })

      mockStoreActions.getMediaMetadata.mockReturnValue(currentMetadata)
      mockHasDomainMetadataChanged.mockReturnValue(false)

      await act(async () => {
        await result.current.updateMediaMetadata('/media/show1', updatedMetadata)
      })

      expect(mockRepository.write).not.toHaveBeenCalled()
      expect(mockStoreActions.updateMediaMetadata).toHaveBeenCalledWith('/media/show1', expect.any(Function))
    })

    it('should handle updater function', async () => {
      const { result } = renderHook(() => useMediaMetadataActions())
      const currentMetadata = createMockUIMediaMetadata({ status: 'idle' })

      mockStoreActions.getMediaMetadata.mockReturnValue(currentMetadata)
      mockHasDomainMetadataChanged.mockReturnValue(true)
      mockRepository.write.mockResolvedValue(undefined)

      const updater = (current: UIMediaMetadata) => ({ ...current, status: 'loading' as const })

      await act(async () => {
        await result.current.updateMediaMetadata('/media/show1', updater)
      })

      expect(mockStoreActions.updateMediaMetadata).toHaveBeenCalled()
    })
  })

  describe('deleteMediaMetadata', () => {
    it('should delete metadata and update store', async () => {
      const { result } = renderHook(() => useMediaMetadataActions())

      mockRepository.delete.mockResolvedValue(undefined)

      await act(async () => {
        await result.current.deleteMediaMetadata('/media/show1')
      })

      expect(mockRepository.delete).toHaveBeenCalledWith('/media/show1', {})
      expect(mockStoreActions.removeMediaMetadata).toHaveBeenCalledWith('/media/show1')
    })
  })

  describe('refreshMediaMetadata', () => {
    it('should refresh metadata', async () => {
      const { result } = renderHook(() => useMediaMetadataActions())
      const currentMetadata = createMockUIMediaMetadata()
      const refreshedMetadata = createMockUIMediaMetadata({ mediaName: 'Refreshed' })

      mockStoreActions.getMediaMetadata.mockReturnValue(currentMetadata)
      mockRepository.refresh.mockResolvedValue(refreshedMetadata)

      await act(async () => {
        await result.current.refreshMediaMetadata('/media/show1')
      })

      expect(mockRepository.refresh).toHaveBeenCalledWith('/media/show1', currentMetadata, { traceId: 'refreshMediaMetadata-test-trace-id' })
      expect(mockStoreActions.addMediaMetadata).toHaveBeenCalledWith(refreshedMetadata)
    })
  })

  describe('reloadAllMediaMetadata', () => {
    it('should reload all metadata', async () => {
      const { result } = renderHook(() => useMediaMetadataActions())
      const folders = ['/media/show1', '/media/show2']
      const reloaded = [
        createMockUIMediaMetadata({ mediaFolderPath: '/media/show1' }),
        createMockUIMediaMetadata({ mediaFolderPath: '/media/show2' }),
      ]

      mockStoreActions.mediaMetadatas = []
      mockRepository.reloadAll.mockResolvedValue(reloaded)

      await act(async () => {
        await result.current.reloadAllMediaMetadata(folders)
      })

      expect(mockRepository.reloadAll).toHaveBeenCalledWith(folders, expect.any(Map), { traceId: 'reloadAllMediaMetadata-test-trace-id' })
      expect(mockStoreActions.addMediaMetadata).toHaveBeenCalledTimes(2)
    })
  })

  describe('initializeMediaMetadata', () => {
    it('should initialize metadata', async () => {
      const { result } = renderHook(() => useMediaMetadataActions())
      const initialized = createMockUIMediaMetadata({ status: 'initializing' })

      mockRepository.initialize.mockResolvedValue(initialized)

      const resultMetadata = await act(async () => {
        return await result.current.initializeMediaMetadata('/media/show1', 'tvshow-folder')
      })

      expect(mockRepository.initialize).toHaveBeenCalledWith('/media/show1', 'tvshow-folder', { traceId: 'initializeMediaMetadata-test-trace-id' })
      expect(mockStoreActions.addMediaMetadata).toHaveBeenCalledWith(initialized)
      expect(resultMetadata).toEqual(initialized)
    })
  })

  describe('upsertMediaMetadata', () => {
    it('should upsert metadata', async () => {
      const { result } = renderHook(() => useMediaMetadataActions())
      const mockMetadata = createMockUIMediaMetadata()

      mockRepository.write.mockResolvedValue(undefined)

      await act(async () => {
        await result.current.upsertMediaMetadata(mockMetadata)
      })

      expect(mockRepository.write).toHaveBeenCalledWith(mockMetadata, { traceId: 'upsertMediaMetadata-test-trace-id' })
      expect(mockStoreActions.addMediaMetadata).toHaveBeenCalledWith(mockMetadata)
    })
  })
})