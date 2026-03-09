import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { MediaMetadataProvider, useMediaMetadata } from './media-metadata-provider'
import type { UIMediaMetadata } from '@/types/UIMediaMetadata'
import type { MediaMetadata } from '@core/types'

vi.mock('@/api/readMediaMetadataV2', () => ({
  readMediaMetadataV2: vi.fn(),
}))

vi.mock('@/api/deleteMediaMetadata', () => ({
  deleteMediaMetadata: vi.fn(),
}))

vi.mock('@/api/writeMediaMetadata', () => ({
  writeMediaMetadata: vi.fn(),
}))

vi.mock('@/providers/config-provider', () => ({
  useConfig: vi.fn(),
}))

vi.mock('@/lib/localStorages', () => ({
  default: {
    selectedFolderIndex: 0,
  },
}))

import { readMediaMetadataV2 } from '@/api/readMediaMetadataV2'
import { deleteMediaMetadata } from '@/api/deleteMediaMetadata'
import { writeMediaMetadata } from '@/api/writeMediaMetadata'
import { useConfig } from '@/providers/config-provider'
import { useMediaMetadataStore } from '@/stores/mediaMetadataStore'

const mockReadMediaMetadataV2 = readMediaMetadataV2 as ReturnType<typeof vi.fn>
const mockDeleteMediaMetadata = deleteMediaMetadata as ReturnType<typeof vi.fn>
const mockWriteMediaMetadata = writeMediaMetadata as ReturnType<typeof vi.fn>
const mockUseConfig = useConfig as ReturnType<typeof vi.fn>

const createMockUIMediaMetadata = (overrides?: Partial<UIMediaMetadata>): UIMediaMetadata => ({
  mediaFolderPath: '/media/show1',
  type: 'tvshow-folder',
  status: 'idle',
  mediaName: 'Show 1',
  ...overrides,
} as UIMediaMetadata)

const createMockMediaMetadata = (overrides?: Partial<MediaMetadata>): MediaMetadata => ({
  mediaFolderPath: '/media/show1',
  type: 'tvshow-folder',
  mediaName: 'Show 1',
  ...overrides,
} as MediaMetadata)

const wrapper = ({ children, initialMetadata }: { children: React.ReactNode, initialMetadata?: UIMediaMetadata[] }) => (
  <MediaMetadataProvider initialMediaMetadatas={initialMetadata || []}>
    {children}
  </MediaMetadataProvider>
)

describe('MediaMetadataProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useMediaMetadataStore.getState().setMediaMetadatas([])
    mockUseConfig.mockReturnValue({
      userConfig: {
        folders: ['/media/show1', '/media/show2'],
      },
    } as any)
    mockDeleteMediaMetadata.mockResolvedValue(undefined)
    mockWriteMediaMetadata.mockResolvedValue(undefined)
  })

  describe('refreshMediaMetadata', () => {
    it('should preserve UI properties when refreshing existing metadata', async () => {
      const initialMetadata = [
        createMockUIMediaMetadata({
          mediaFolderPath: '/media/show1',
          status: 'loading',
          mediaName: 'Old Name',
        }),
      ]

      const refreshedMetadata = createMockMediaMetadata({
        mediaFolderPath: '/media/show1',
        mediaName: 'New Name',
      })

      mockReadMediaMetadataV2.mockResolvedValue(refreshedMetadata)

      const { result } = renderHook(() => useMediaMetadata(), {
        wrapper: ({ children }) => wrapper({ children, initialMetadata }),
      })

      await act(async () => {
        await result.current.refreshMediaMetadata('/media/show1')
      })

      expect(result.current.mediaMetadatas[0].mediaName).toBe('New Name')
      expect(result.current.mediaMetadatas[0].status).toBe('loading')
      expect(mockReadMediaMetadataV2).toHaveBeenCalledWith('/media/show1', expect.any(Object))
    })

    it('should set idle status when refreshing new metadata', async () => {
      const refreshedMetadata = createMockMediaMetadata({
        mediaFolderPath: '/media/show1',
        mediaName: 'New Show',
      })

      mockReadMediaMetadataV2.mockResolvedValue(refreshedMetadata)

      const { result } = renderHook(() => useMediaMetadata(), {
        wrapper,
      })

      await act(async () => {
        await result.current.refreshMediaMetadata('/media/show1')
      })

      expect(result.current.mediaMetadatas[0].mediaName).toBe('New Show')
      expect(result.current.mediaMetadatas[0].status).toBe('idle')
    })

    it('should handle error when refresh fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const error = new Error('Network error')
      mockReadMediaMetadataV2.mockRejectedValue(error)

      const { result } = renderHook(() => useMediaMetadata(), {
        wrapper,
      })

      await act(async () => {
        await result.current.refreshMediaMetadata('/media/show1')
      })

      expect(result.current.mediaMetadatas).toHaveLength(0)
      expect(consoleErrorSpy).toHaveBeenCalled()
      consoleErrorSpy.mockRestore()
    })

    it('should preserve ok status when refreshing', async () => {
      const initialMetadata = [
        createMockUIMediaMetadata({
          mediaFolderPath: '/media/show1',
          status: 'ok',
          mediaName: 'Old Name',
        }),
      ]

      const refreshedMetadata = createMockMediaMetadata({
        mediaFolderPath: '/media/show1',
        mediaName: 'New Name',
      })

      mockReadMediaMetadataV2.mockResolvedValue(refreshedMetadata)

      const { result } = renderHook(() => useMediaMetadata(), {
        wrapper: ({ children }) => wrapper({ children, initialMetadata }),
      })

      await act(async () => {
        await result.current.refreshMediaMetadata('/media/show1')
      })

      expect(result.current.mediaMetadatas[0].mediaName).toBe('New Name')
      expect(result.current.mediaMetadatas[0].status).toBe('ok')
    })

    it('should preserve error status when refreshing', async () => {
      const initialMetadata = [
        createMockUIMediaMetadata({
          mediaFolderPath: '/media/show1',
          status: 'error_loading_metadata',
          mediaName: 'Old Name',
        }),
      ]

      const refreshedMetadata = createMockMediaMetadata({
        mediaFolderPath: '/media/show1',
        mediaName: 'New Name',
      })

      mockReadMediaMetadataV2.mockResolvedValue(refreshedMetadata)

      const { result } = renderHook(() => useMediaMetadata(), {
        wrapper: ({ children }) => wrapper({ children, initialMetadata }),
      })

      await act(async () => {
        await result.current.refreshMediaMetadata('/media/show1')
      })

      expect(result.current.mediaMetadatas[0].mediaName).toBe('New Name')
      expect(result.current.mediaMetadatas[0].status).toBe('error_loading_metadata')
    })

    it('should preserve initializing status when refreshing', async () => {
      const initialMetadata = [
        createMockUIMediaMetadata({
          mediaFolderPath: '/media/show1',
          status: 'initializing',
          mediaName: 'Old Name',
        }),
      ]

      const refreshedMetadata = createMockMediaMetadata({
        mediaFolderPath: '/media/show1',
        mediaName: 'New Name',
      })

      mockReadMediaMetadataV2.mockResolvedValue(refreshedMetadata)

      const { result } = renderHook(() => useMediaMetadata(), {
        wrapper: ({ children }) => wrapper({ children, initialMetadata }),
      })

      await act(async () => {
        await result.current.refreshMediaMetadata('/media/show1')
      })

      expect(result.current.mediaMetadatas[0].mediaName).toBe('New Name')
      expect(result.current.mediaMetadatas[0].status).toBe('initializing')
    })

    it('should preserve folder_not_found status when refreshing', async () => {
      const initialMetadata = [
        createMockUIMediaMetadata({
          mediaFolderPath: '/media/show1',
          status: 'folder_not_found',
          mediaName: 'Old Name',
        }),
      ]

      const refreshedMetadata = createMockMediaMetadata({
        mediaFolderPath: '/media/show1',
        mediaName: 'New Name',
      })

      mockReadMediaMetadataV2.mockResolvedValue(refreshedMetadata)

      const { result } = renderHook(() => useMediaMetadata(), {
        wrapper: ({ children }) => wrapper({ children, initialMetadata }),
      })

      await act(async () => {
        await result.current.refreshMediaMetadata('/media/show1')
      })

      expect(result.current.mediaMetadatas[0].mediaName).toBe('New Name')
      expect(result.current.mediaMetadatas[0].status).toBe('folder_not_found')
    })

    it('should preserve updating status when refreshing', async () => {
      const initialMetadata = [
        createMockUIMediaMetadata({
          mediaFolderPath: '/media/show1',
          status: 'updating',
          mediaName: 'Old Name',
        }),
      ]

      const refreshedMetadata = createMockMediaMetadata({
        mediaFolderPath: '/media/show1',
        mediaName: 'New Name',
      })

      mockReadMediaMetadataV2.mockResolvedValue(refreshedMetadata)

      const { result } = renderHook(() => useMediaMetadata(), {
        wrapper: ({ children }) => wrapper({ children, initialMetadata }),
      })

      await act(async () => {
        await result.current.refreshMediaMetadata('/media/show1')
      })

      expect(result.current.mediaMetadatas[0].mediaName).toBe('New Name')
      expect(result.current.mediaMetadatas[0].status).toBe('updating')
    })
  })

  describe('reloadMediaMetadatas', () => {
    it('should preserve UI properties when reloading all metadata', async () => {
      const initialMetadata = [
        createMockUIMediaMetadata({
          mediaFolderPath: '/media/show1',
          status: 'loading',
          mediaName: 'Old Name 1',
        }),
        createMockUIMediaMetadata({
          mediaFolderPath: '/media/show2',
          status: 'ok',
          mediaName: 'Old Name 2',
        }),
      ]

      const refreshedMetadata1 = createMockMediaMetadata({
        mediaFolderPath: '/media/show1',
        mediaName: 'New Name 1',
      })

      const refreshedMetadata2 = createMockMediaMetadata({
        mediaFolderPath: '/media/show2',
        mediaName: 'New Name 2',
      })

      mockReadMediaMetadataV2
        .mockResolvedValueOnce(refreshedMetadata1)
        .mockResolvedValueOnce(refreshedMetadata2)

      const { result } = renderHook(() => useMediaMetadata(), {
        wrapper: ({ children }) => wrapper({ children, initialMetadata }),
      })

      // Flush useEffect so store is synced with initialMetadata
      await act(async () => {})

      // Ensure store was synced so reloadMediaMetadatas reads correct currentMetadataMap
      expect(result.current.mediaMetadatas).toHaveLength(2)
      expect(result.current.mediaMetadatas[0].status).toBe('loading')

      await act(async () => {
        await result.current.reloadMediaMetadatas()
      })

      expect(result.current.mediaMetadatas[0].mediaName).toBe('New Name 1')
      expect(result.current.mediaMetadatas[0].status).toBe('loading')
      expect(result.current.mediaMetadatas[1].mediaName).toBe('New Name 2')
      expect(result.current.mediaMetadatas[1].status).toBe('ok')
    })
  })

  describe('addMediaMetadata', () => {
    it('should add metadata to the list', async () => {
      const newMetadata = createMockUIMediaMetadata({
        mediaFolderPath: '/media/show1',
        status: 'idle',
      })

      const { result } = renderHook(() => useMediaMetadata(), {
        wrapper,
      })

      await act(async () => {
        await result.current.addMediaMetadata(newMetadata)
      })

      expect(result.current.mediaMetadatas).toHaveLength(1)
      expect(result.current.mediaMetadatas[0].mediaFolderPath).toBe('/media/show1')
      expect(mockWriteMediaMetadata).toHaveBeenCalledWith(newMetadata, expect.any(Object))
    })
  })

  describe('updateMediaMetadata', () => {
    it('should update existing metadata', async () => {
      const initialMetadata = [
        createMockUIMediaMetadata({
          mediaFolderPath: '/media/show1',
          mediaName: 'Old Name',
        }),
      ]

      const updatedMetadata = createMockUIMediaMetadata({
        mediaFolderPath: '/media/show1',
        mediaName: 'New Name',
      })

      mockWriteMediaMetadata.mockResolvedValue(undefined)

      const { result } = renderHook(() => useMediaMetadata(), {
        wrapper: ({ children }) => wrapper({ children, initialMetadata }),
      })

      await act(async () => {
        await result.current.updateMediaMetadata('/media/show1', updatedMetadata)
      })

      expect(result.current.mediaMetadatas[0].mediaName).toBe('New Name')
      expect(mockWriteMediaMetadata).toHaveBeenCalled()
    })
  })

  describe('removeMediaMetadata', () => {
    it('should remove metadata from the list', async () => {
      const initialMetadata = [
        createMockUIMediaMetadata({
          mediaFolderPath: '/media/show1',
        }),
        createMockUIMediaMetadata({
          mediaFolderPath: '/media/show2',
        }),
      ]

      const { result } = renderHook(() => useMediaMetadata(), {
        wrapper: ({ children }) => wrapper({ children, initialMetadata }),
      })

      await act(async () => {
        await result.current.removeMediaMetadata('/media/show1')
      })

      expect(result.current.mediaMetadatas).toHaveLength(1)
      expect(result.current.mediaMetadatas[0].mediaFolderPath).toBe('/media/show2')
      expect(mockDeleteMediaMetadata).toHaveBeenCalledWith('/media/show1')
    })
  })

  describe('getMediaMetadata', () => {
    it('should return metadata by path', () => {
      const initialMetadata = [
        createMockUIMediaMetadata({
          mediaFolderPath: '/media/show1',
        }),
        createMockUIMediaMetadata({
          mediaFolderPath: '/media/show2',
        }),
      ]

      const { result } = renderHook(() => useMediaMetadata(), {
        wrapper: ({ children }) => wrapper({ children, initialMetadata }),
      })

      const metadata = result.current.getMediaMetadata('/media/show2')

      expect(metadata?.mediaFolderPath).toBe('/media/show2')
    })

    it('should return undefined for non-existent path', () => {
      const initialMetadata = [
        createMockUIMediaMetadata({
          mediaFolderPath: '/media/show1',
        }),
      ]

      const { result } = renderHook(() => useMediaMetadata(), {
        wrapper: ({ children }) => wrapper({ children, initialMetadata }),
      })

      const metadata = result.current.getMediaMetadata('/media/show2')

      expect(metadata).toBeUndefined()
    })
  })

  describe('updateMediaMetadataStatus', () => {
    it('should update status of metadata by path', () => {
      const initialMetadata = [
        createMockUIMediaMetadata({
          mediaFolderPath: '/media/show1',
          status: 'idle',
        }),
      ]

      const { result } = renderHook(() => useMediaMetadata(), {
        wrapper: ({ children }) => wrapper({ children, initialMetadata }),
      })

      act(() => {
        result.current.updateMediaMetadataStatus('/media/show1', 'loading')
      })

      expect(result.current.mediaMetadatas[0].status).toBe('loading')
    })
  })

  describe('setSelectedMediaMetadata', () => {
    it('should set selected metadata by index', () => {
      const initialMetadata = [
        createMockUIMediaMetadata({
          mediaFolderPath: '/media/show1',
        }),
        createMockUIMediaMetadata({
          mediaFolderPath: '/media/show2',
        }),
      ]

      const { result } = renderHook(() => useMediaMetadata(), {
        wrapper: ({ children }) => wrapper({ children, initialMetadata }),
      })

      act(() => {
        result.current.setSelectedMediaMetadata(1)
      })

      expect(result.current.selectedMediaMetadata?.mediaFolderPath).toBe('/media/show2')
    })
  })

  describe('setSelectedMediaMetadataByMediaFolderPath', () => {
    it('should set selected metadata by path', () => {
      const initialMetadata = [
        createMockUIMediaMetadata({
          mediaFolderPath: '/media/show1',
        }),
        createMockUIMediaMetadata({
          mediaFolderPath: '/media/show2',
        }),
      ]

      const { result } = renderHook(() => useMediaMetadata(), {
        wrapper: ({ children }) => wrapper({ children, initialMetadata }),
      })

      act(() => {
        result.current.setSelectedMediaMetadataByMediaFolderPath('/media/show2')
      })

      expect(result.current.selectedMediaMetadata?.mediaFolderPath).toBe('/media/show2')
    })
  })
})
