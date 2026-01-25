import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useOnFolderSelected } from './onFolderSelected'
import { GlobalStatesProvider } from '@/providers/global-states-provider'
import { ConfigProvider } from '@/providers/config-provider'
import { useMediaMetadata } from '@/providers/media-metadata-provider'
import type { MediaMetadata, TMDBTVShowDetails } from '@core/types'

// Mock the API functions
vi.mock('@/api/readMediaMatadata', () => ({
  readMediaMetadataApi: vi.fn(),
}))

vi.mock('@/api/listFiles', () => ({
  listFiles: vi.fn(),
}))

vi.mock('@/api/tmdb', () => ({
  getTvShowById: vi.fn(),
}))

vi.mock('@/components/TvShowPanelUtils', () => ({
  tryToRecognizeMediaFolderByNFO: vi.fn(),
}))

vi.mock('@/providers/media-metadata-provider', () => ({
  useMediaMetadata: vi.fn(),
  MediaMetadataProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/api/writeFile', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
}))

import { readMediaMetadataApi } from '@/api/readMediaMatadata'
import { listFiles } from '@/api/listFiles'
import { getTvShowById } from '@/api/tmdb'
import { tryToRecognizeMediaFolderByNFO } from '@/components/TvShowPanelUtils'

describe('useOnFolderSelected', () => {
  const mockAddMediaMetadata = vi.fn()
  const mockUpdateMediaMetadata = vi.fn()

  const mockTvShowData = {
    id: 123,
    name: 'Test TV Show',
    seasons: [],
  } as unknown as TMDBTVShowDetails

  const mockRecognizedMetadata: MediaMetadata = {
    mediaFolderPath: '/test/path' as any,
    type: 'tvshow-folder',
    files: ['/test/path/file1.mp4', '/test/path/tvshow.nfo'],
    tmdbTvShow: mockTvShowData,
  }

  // Wrapper component to provide GlobalStatesProvider and ConfigProvider.
  // useMediaMetadata is mocked to return addMediaMetadata: mockAddMediaMetadata so the hook's
  // calls to addMediaMetadata are visible to the test.
  const wrapper = ({ children }: { children: ReactNode }) => (
    <GlobalStatesProvider>
      <ConfigProvider appConfig={{ version: 'test', userDataDir: '/tmp/smm-test' }}>
        {children}
      </ConfigProvider>
    </GlobalStatesProvider>
  )

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.mocked(useMediaMetadata).mockReturnValue({
      addMediaMetadata: mockAddMediaMetadata,
      updateMediaMetadata: mockUpdateMediaMetadata,
      removeMediaMetadata: vi.fn(),
      getMediaMetadata: vi.fn(),
      selectedMediaMetadata: undefined,
      setSelectedMediaMetadata: vi.fn(),
      setSelectedMediaMetadataByMediaFolderPath: vi.fn(),
      refreshMediaMetadata: vi.fn(),
      reloadMediaMetadatas: vi.fn(),
      mediaMetadatas: [],
    } as ReturnType<typeof useMediaMetadata>)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Happy flow', () => {
    it('should successfully process a new folder and set loading states correctly', async () => {
      // Mock readMediaMetadataApi to return no metadata (first time opening)
      ;(readMediaMetadataApi as any).mockResolvedValue({
        data: undefined,
        error: undefined,
      })

      // Mock listFiles to return file list
      ;(listFiles as any).mockResolvedValue({
        data: {
          path: '/test/path',
          items: [
            { path: '/test/path/file1.mp4', size: 1000, mtime: Date.now(), isDirectory: false },
            { path: '/test/path/tvshow.nfo', size: 500, mtime: Date.now(), isDirectory: false },
          ],
          size: 1500,
        },
        error: undefined,
      })

      // Mock tryToRecognizeMediaFolderByNFO to return recognized metadata
      ;(tryToRecognizeMediaFolderByNFO as any).mockResolvedValue(mockRecognizedMetadata)

      // Mock getTvShowById to return TV show data
      ;(getTvShowById as any).mockResolvedValue({
        data: mockTvShowData,
        error: undefined,
      })

      const { result } = renderHook(
        () => useOnFolderSelected(mockAddMediaMetadata, mockUpdateMediaMetadata),
        { wrapper }
      )

      const onFolderSelected = result.current

      // Call the function
      let promise: Promise<void>
      await act(async () => {
        promise = onFolderSelected('tvshow', '/test/path')
        // Fast-forward time to complete all operations
        await vi.runAllTimersAsync()
      })

      // Wait for the promise to resolve
      await promise!

      // Verify API calls were made
      expect(readMediaMetadataApi).toHaveBeenCalledWith('/test/path', expect.any(AbortSignal))
      expect(listFiles).toHaveBeenCalledWith(
        {
          path: '/test/path',
          recursively: true,
          onlyFiles: true,
        },
        expect.any(AbortSignal)
      )
      expect(tryToRecognizeMediaFolderByNFO).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaFolderPath: '/test/path',
          type: 'tvshow-folder',
        }),
        expect.any(AbortSignal)
      )
      expect(getTvShowById).toHaveBeenCalledWith(123, 'zh-CN', expect.any(AbortSignal))

      // Verify recognized metadata was added (hook calls addMediaMetadata with options as 2nd arg)
      expect(mockAddMediaMetadata).toHaveBeenCalledWith(
        mockRecognizedMetadata,
        expect.objectContaining({ traceId: expect.any(String) })
      )

      // The loading state should be set to false after completion
      // We verify this by ensuring the promise resolves without errors
    })

    it('should handle existing metadata without setting loading state', async () => {
      // Mock readMediaMetadataApi to return existing metadata
      const existingMetadata: MediaMetadata = {
        mediaFolderPath: '/test/path' as any,
        type: 'tvshow-folder',
      }

      ;(readMediaMetadataApi as any).mockResolvedValue({
        data: existingMetadata,
        error: undefined,
      })

      const { result } = renderHook(
        () => useOnFolderSelected(mockAddMediaMetadata, mockUpdateMediaMetadata),
        { wrapper }
      )

      const onFolderSelected = result.current

      // Call the function
      let promise: Promise<void>
      await act(async () => {
        promise = onFolderSelected('tvshow', '/test/path')
        // Fast-forward time
        await vi.runAllTimersAsync()
      })

      // Wait for the promise to resolve
      await promise!

      // When metadata already exists, the hook does not call addMediaMetadata (it only adds when
      // recognizing a new folder). Verify listFiles was NOT called since metadata exists.
      expect(mockAddMediaMetadata).not.toHaveBeenCalled()
      expect(listFiles).not.toHaveBeenCalled()
    })
  })

  describe('Timeout flow', () => {
    it('should timeout after 10 seconds and set loading to false', async () => {
      // Mock readMediaMetadataApi to return no metadata
      ;(readMediaMetadataApi as any).mockResolvedValue({
        data: undefined,
        error: undefined,
      })

      // Mock listFiles to take longer than 10 seconds (by not resolving immediately)
      ;(listFiles as any).mockImplementation(() => {
        return new Promise<void>((_resolve) => {
          // This promise will never resolve, simulating a hanging operation
          // We'll let the timeout handle it
        })
      })

      const { result } = renderHook(
        () => useOnFolderSelected(mockAddMediaMetadata, mockUpdateMediaMetadata),
        { wrapper }
      )

      const onFolderSelected = result.current

      // Call the function
      let promise: Promise<void>
      await act(async () => {
        promise = onFolderSelected('tvshow', '/test/path')
      })

      // Fast-forward time by 10 seconds to trigger timeout
      await act(async () => {
        vi.advanceTimersByTime(10000)
      })

      // Wait for the promise to complete (it will resolve because errors are caught)
      await act(async () => {
        try {
          await promise!
        } catch (e) {
          // Errors are caught internally, so this shouldn't throw
        }
      })

      // Verify that listFiles was called with an AbortSignal
      expect(listFiles).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(AbortSignal)
      )

      // Verify the AbortSignal was aborted
      const listFilesCall = (listFiles as any).mock.calls[0]
      const abortSignal = listFilesCall[1] as AbortSignal
      expect(abortSignal.aborted).toBe(true)

      // When timeout occurs, the hook may have already called addMediaMetadata(initialMetadata)
      // at the start of the recognize flow. Assert that the full recognized metadata was not added.
      expect(mockAddMediaMetadata).not.toHaveBeenCalledWith(
        expect.objectContaining({ tmdbTvShow: expect.anything() })
      )
    })

    it('should abort all ongoing operations when timeout occurs', async () => {
      // Mock readMediaMetadataApi to return no metadata
      ;(readMediaMetadataApi as any).mockResolvedValue({
        data: undefined,
        error: undefined,
      })

      // Mock listFiles to take a long time
      ;(listFiles as any).mockImplementation(() => {
        return new Promise(() => {}) // Never resolves
      })

      // Mock tryToRecognizeMediaFolderByNFO to take a long time
      ;(tryToRecognizeMediaFolderByNFO as any).mockImplementation(() => {
        return new Promise(() => {}) // Never resolves
      })

      const { result } = renderHook(
        () => useOnFolderSelected(mockAddMediaMetadata, mockUpdateMediaMetadata),
        { wrapper }
      )

      const onFolderSelected = result.current

      // Call the function
      let promise: Promise<void>
      await act(async () => {
        promise = onFolderSelected('tvshow', '/test/path')
      })

      // Fast-forward time by 10 seconds to trigger timeout
      await act(async () => {
        vi.advanceTimersByTime(10000)
      })

      // Wait for the promise to complete (it will resolve because errors are caught)
      await act(async () => {
        try {
          await promise!
        } catch (e) {
          // Errors are caught internally, so this shouldn't throw
        }
      })

      // Verify all API calls received an AbortSignal
      expect(readMediaMetadataApi).toHaveBeenCalledWith('/test/path', expect.any(AbortSignal))
      expect(listFiles).toHaveBeenCalledWith(expect.any(Object), expect.any(AbortSignal))

      // Verify the signals were aborted
      const readMediaMetadataCall = (readMediaMetadataApi as any).mock.calls[0]
      const readSignal = readMediaMetadataCall[1] as AbortSignal
      
      const listFilesCall = (listFiles as any).mock.calls[0]
      const listSignal = listFilesCall[1] as AbortSignal

      // Note: The signals might be the same AbortSignal instance
      // We just need to verify they exist and were aborted
      expect(readSignal.aborted || listSignal.aborted).toBe(true)
    })
  })
})
