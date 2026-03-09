import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMediaMetadataStore } from './mediaMetadataStore'
import type { UIMediaMetadata } from '@/types/UIMediaMetadata'

vi.mock('@/lib/localStorages', () => ({
  default: {
    selectedFolderIndex: 0,
  },
}))

import localStorages from '@/lib/localStorages'

const mockLocalStorages = localStorages as any

const createMockUIMediaMetadata = (overrides?: Partial<UIMediaMetadata>): UIMediaMetadata => ({
  mediaFolderPath: '/media/show1',
  type: 'tvshow-folder',
  status: 'idle',
  mediaName: 'Show 1',
  files: [],
  mediaFiles: [],
  ...overrides,
} as UIMediaMetadata)

describe('MediaMetadataStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset localStorage mock
    mockLocalStorages.selectedFolderIndex = 0
  })

  describe('initial state', () => {
    it('should initialize with empty mediaMetadatas and selectedIndex from localStorage', () => {
      const { result } = renderHook(() => useMediaMetadataStore())

      expect(result.current.mediaMetadatas).toEqual([])
      expect(result.current.selectedIndex).toBe(0)
    })
  })

  describe('setMediaMetadatas', () => {
    it('should set media metadatas', () => {
      const { result } = renderHook(() => useMediaMetadataStore())
      const mockMetadata = [createMockUIMediaMetadata()]

      act(() => {
        result.current.setMediaMetadatas(mockMetadata)
      })

      expect(result.current.mediaMetadatas).toEqual(mockMetadata)
    })
  })

  describe('addMediaMetadata', () => {
    it('should add new metadata when path does not exist', () => {
      const { result } = renderHook(() => useMediaMetadataStore())
      const mockMetadata = createMockUIMediaMetadata()

      act(() => {
        result.current.addMediaMetadata(mockMetadata)
      })

      expect(result.current.mediaMetadatas).toEqual([mockMetadata])
    })

    it('should update existing metadata when path exists', () => {
      const { result } = renderHook(() => useMediaMetadataStore())
      const existingMetadata = createMockUIMediaMetadata({ status: 'idle' })
      const updatedMetadata = createMockUIMediaMetadata({ status: 'loading' })

      act(() => {
        result.current.addMediaMetadata(existingMetadata)
        result.current.addMediaMetadata(updatedMetadata)
      })

      expect(result.current.mediaMetadatas).toEqual([updatedMetadata])
    })
  })

  describe('updateMediaMetadata', () => {
    it('should update metadata using updater function', () => {
      const { result } = renderHook(() => useMediaMetadataStore())
      const initialMetadata = createMockUIMediaMetadata({ status: 'idle' })

      act(() => {
        result.current.addMediaMetadata(initialMetadata)
        result.current.updateMediaMetadata('/media/show1', (current) => ({
          ...current,
          status: 'loading',
        }))
      })

      expect(result.current.mediaMetadatas[0].status).toBe('loading')
    })

    it('should not update if path does not exist', () => {
      const { result } = renderHook(() => useMediaMetadataStore())
      const initialMetadata = createMockUIMediaMetadata()

      act(() => {
        result.current.addMediaMetadata(initialMetadata)
        result.current.updateMediaMetadata('/nonexistent/path', (current) => ({
          ...current,
          status: 'loading',
        }))
      })

      expect(result.current.mediaMetadatas[0].status).toBe('idle')
    })
  })

  describe('removeMediaMetadata', () => {
    it('should remove metadata by path', () => {
      const { result } = renderHook(() => useMediaMetadataStore())
      const mockMetadata = createMockUIMediaMetadata()

      act(() => {
        result.current.addMediaMetadata(mockMetadata)
        result.current.removeMediaMetadata('/media/show1')
      })

      expect(result.current.mediaMetadatas).toEqual([])
    })
  })

  describe('getMediaMetadata', () => {
    it('should return metadata by path', () => {
      const { result } = renderHook(() => useMediaMetadataStore())
      const mockMetadata = createMockUIMediaMetadata()

      act(() => {
        result.current.addMediaMetadata(mockMetadata)
      })

      const found = result.current.getMediaMetadata('/media/show1')
      expect(found).toEqual(mockMetadata)
    })

    it('should return undefined for non-existent path', () => {
      const { result } = renderHook(() => useMediaMetadataStore())

      const found = result.current.getMediaMetadata('/nonexistent/path')
      expect(found).toBeUndefined()
    })
  })

  describe('updateMediaMetadataStatus', () => {
    it('should update status of metadata by path', () => {
      const { result } = renderHook(() => useMediaMetadataStore())
      const mockMetadata = createMockUIMediaMetadata({ status: 'idle' })

      act(() => {
        result.current.addMediaMetadata(mockMetadata)
        result.current.updateMediaMetadataStatus('/media/show1', 'loading')
      })

      expect(result.current.mediaMetadatas[0].status).toBe('loading')
    })
  })

  describe('selection management', () => {
    it('should set selected index and update localStorage', () => {
      const { result } = renderHook(() => useMediaMetadataStore())

      act(() => {
        result.current.setSelectedIndex(5)
      })

      expect(result.current.selectedIndex).toBe(5)
      expect(mockLocalStorages.selectedFolderIndex).toBe(5)
    })

    it('should set selected index by media folder path', () => {
      const { result } = renderHook(() => useMediaMetadataStore())
      const mockMetadata1 = createMockUIMediaMetadata({ mediaFolderPath: '/media/show1' })
      const mockMetadata2 = createMockUIMediaMetadata({ mediaFolderPath: '/media/show2' })

      act(() => {
        result.current.addMediaMetadata(mockMetadata1)
        result.current.addMediaMetadata(mockMetadata2)
        result.current.setSelectedByMediaFolderPath('/media/show2')
      })

      expect(result.current.selectedIndex).toBe(1)
      expect(mockLocalStorages.selectedFolderIndex).toBe(1)
    })
  })

  describe('selectors', () => {
    it('should provide selectedMediaMetadata from selector', () => {
      const { result } = renderHook(() => {
        const store = useMediaMetadataStore()
        return {
          ...store,
          selectedMediaMetadata: store.selectedIndex >= 0 && store.selectedIndex < store.mediaMetadatas.length
            ? store.mediaMetadatas[store.selectedIndex]
            : undefined,
        }
      })

      const mockMetadata = createMockUIMediaMetadata()

      act(() => {
        result.current.setSelectedIndex(0) // Ensure selectedIndex is 0
        result.current.addMediaMetadata(mockMetadata)
      })

      expect(result.current.selectedMediaMetadata).toEqual(mockMetadata)
    })

    it('should return undefined when selectedIndex is out of bounds', () => {
      const { result } = renderHook(() => {
        const store = useMediaMetadataStore()
        return {
          ...store,
          selectedMediaMetadata: store.selectedIndex >= 0 && store.selectedIndex < store.mediaMetadatas.length
            ? store.mediaMetadatas[store.selectedIndex]
            : undefined,
        }
      })

      act(() => {
        result.current.setSelectedIndex(5) // Out of bounds
      })

      expect(result.current.selectedMediaMetadata).toBeUndefined()
    })
  })
})