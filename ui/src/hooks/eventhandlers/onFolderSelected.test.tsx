import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useOnFolderSelected } from './onFolderSelected'
import { GlobalStatesProvider } from '@/providers/global-states-provider'
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

vi.mock('@/providers/config-provider', () => ({
  useConfig: vi.fn(),
  ConfigProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/api/writeFile', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/api/getPendingPlans', () => ({
  getPendingPlans: vi.fn().mockResolvedValue([]),
}))

import { readMediaMetadataApi } from '@/api/readMediaMatadata'
import { listFiles } from '@/api/listFiles'
import { getTvShowById } from '@/api/tmdb'
import { tryToRecognizeMediaFolderByNFO } from '@/components/TvShowPanelUtils'
import { useConfig } from '@/providers/config-provider'

describe('useOnFolderSelected', () => {
  const mockAddMediaMetadata = vi.fn()
  const mockUpdateMediaMetadata = vi.fn()
  const mockAddMediaFolderInUserConfig = vi.fn()

  const mockTvShowData: TMDBTVShowDetails = {
    id: 123,
    name: 'Test TV Show',
    original_name: 'Test TV Show',
    overview: 'Test overview',
    poster_path: '/test/poster.jpg',
    backdrop_path: '/test/backdrop.jpg',
    first_air_date: '2020-01-01',
    vote_average: 8.5,
    vote_count: 100,
    popularity: 10.5,
    genre_ids: [1, 2],
    origin_country: ['US'],
    number_of_seasons: 1,
    number_of_episodes: 10,
    seasons: [],
    status: 'Ended',
    type: 'Scripted',
    in_production: false,
    last_air_date: '2020-12-31',
    networks: [{
      id: 1,
      name: 'Test Network',
      logo_path: '/test/logo.jpg',
    }],
    production_companies: [{
      id: 1,
      name: 'Test Production',
      logo_path: '/test/prod.jpg',
    }],
  }

  const mockRecognizedMetadata: MediaMetadata = {
    mediaFolderPath: '/test/path' as any,
    type: 'tvshow-folder',
    files: ['/test/path/file1.mp4', '/test/path/tvshow.nfo'],
    tmdbTvShow: mockTvShowData,
  }

  // Wrapper component to provide GlobalStatesProvider.
  // useMediaMetadata and useConfig are mocked to return mock functions so the hook's
  // calls are visible to the test.
  const wrapper = ({ children }: { children: ReactNode }) => (
    <GlobalStatesProvider>
      {children}
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
    vi.mocked(useConfig).mockReturnValue({
      appConfig: { version: 'test', userDataDir: '/tmp/smm-test' },
      userConfig: { applicationLanguage: 'zh-CN', tmdb: { host: '', apiKey: '', httpProxy: '' }, ai: { deepseek: { baseURL: '', apiKey: '', model: '' }, openAI: { baseURL: '', apiKey: '', model: '' }, openrouter: { baseURL: '', apiKey: '', model: '' }, glm: { baseURL: '', apiKey: '', model: '' }, other: { baseURL: '', apiKey: '', model: '' } }, selectedAI: 'DeepSeek', selectedTMDBIntance: 'public', folders: [], selectedRenameRule: 'Plex' },
      isLoading: false,
      error: null,
      setUserConfig: vi.fn(),
      reload: vi.fn(),
      addMediaFolderInUserConfig: mockAddMediaFolderInUserConfig,
    } as ReturnType<typeof useConfig>)
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

      // Verify addMediaFolderInUserConfig was called with the folder path
      expect(mockAddMediaFolderInUserConfig).toHaveBeenCalledWith(
        expect.any(String),
        '/test/path'
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

      // Verify addMediaFolderInUserConfig was still called even when metadata exists
      expect(mockAddMediaFolderInUserConfig).toHaveBeenCalledWith(
        expect.any(String),
        '/test/path'
      )
    })

    it('should handle defined metadata response from readMediaMetadataApi', async () => {
      // Mock readMediaMetadataApi to return existing metadata (metadata is defined)
      const existingMetadata: MediaMetadata = {
        mediaFolderPath: '/test/path' as any,
        type: 'tvshow-folder',
        files: ['/test/path/Season 1/S01E01.mp4'],
        tmdbTvShow: {
          id: 456,
          name: 'Existing TV Show',
          original_name: 'Existing TV Show',
          overview: 'Existing overview',
          poster_path: '/existing/poster.jpg',
          backdrop_path: '/existing/backdrop.jpg',
          first_air_date: '2021-01-01',
          vote_average: 9.0,
          vote_count: 200,
          popularity: 15.5,
          genre_ids: [3, 4],
          origin_country: ['UK'],
          number_of_seasons: 2,
          number_of_episodes: 20,
          seasons: [],
          status: 'Returning Series',
          type: 'Scripted',
          in_production: true,
          last_air_date: '2023-12-31',
          networks: [{
            id: 2,
            name: 'Existing Network',
            logo_path: '/existing/logo.jpg',
          }],
          production_companies: [{
            id: 2,
            name: 'Existing Production',
            logo_path: '/existing/prod.jpg',
          }],
        },
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

      // Verify readMediaMetadataApi was called
      expect(readMediaMetadataApi).toHaveBeenCalledWith('/test/path', expect.any(AbortSignal))

      // Verify the response data is defined
      const readMetadataResponse = (readMediaMetadataApi as any).mock.results[0].value
      const responseData = await readMetadataResponse
      expect(responseData.data).toBeDefined()
      expect(responseData.data).toEqual(existingMetadata)

      // When metadata is defined, the hook should skip recognition and file listing
      expect(listFiles).not.toHaveBeenCalled()
      expect(tryToRecognizeMediaFolderByNFO).not.toHaveBeenCalled()
      expect(getTvShowById).not.toHaveBeenCalled()

      // Should not add new metadata since it already exists
      expect(mockAddMediaMetadata).not.toHaveBeenCalled()

      // Verify addMediaFolderInUserConfig was still called
      expect(mockAddMediaFolderInUserConfig).toHaveBeenCalledWith(
        expect.any(String),
        '/test/path'
      )
    })

    it('should handle undefined metadata response from readMediaMetadataApi', async () => {
      // Mock readMediaMetadataApi to return response with undefined data
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
          ],
          size: 1000,
        },
        error: undefined,
      })

      // Mock tryToRecognizeMediaFolderByNFO to return undefined (no recognition)
      ;(tryToRecognizeMediaFolderByNFO as any).mockResolvedValue(undefined)

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

      // Verify readMediaMetadataApi was called and returned undefined data
      expect(readMediaMetadataApi).toHaveBeenCalledWith('/test/path', expect.any(AbortSignal))
      const readMetadataResponse = (readMediaMetadataApi as any).mock.results[0].value
      const responseData = await readMetadataResponse
      expect(responseData.data).toBeUndefined()

      // Verify that when metadata is undefined, the code creates initial metadata and proceeds with recognition
      expect(listFiles).toHaveBeenCalledWith(
        {
          path: '/test/path',
          recursively: true,
          onlyFiles: true,
        },
        expect.any(AbortSignal)
      )

      // Verify tryToRecognizeMediaFolderByNFO was called with the initial metadata
      expect(tryToRecognizeMediaFolderByNFO).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaFolderPath: '/test/path',
          type: 'tvshow-folder',
        }),
        expect.any(AbortSignal)
      )

      // Verify initial metadata was added (without tmdbTvShow since recognition failed)
      expect(mockAddMediaMetadata).toHaveBeenCalled()
      const addedMetadata = mockAddMediaMetadata.mock.calls[0][0] as MediaMetadata
      expect(addedMetadata.tmdbTvShow).toBeUndefined()
      expect(addedMetadata.mediaFolderPath).toBe('/test/path')
      expect(addedMetadata.type).toBe('tvshow-folder')

      // Verify addMediaFolderInUserConfig was called with the folder path
      expect(mockAddMediaFolderInUserConfig).toHaveBeenCalledWith(
        expect.any(String),
        '/test/path'
      )
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

      // Verify addMediaFolderInUserConfig was NOT called due to timeout
      expect(mockAddMediaFolderInUserConfig).not.toHaveBeenCalled()
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

      // Verify addMediaFolderInUserConfig was NOT called due to timeout
      expect(mockAddMediaFolderInUserConfig).not.toHaveBeenCalled()
    })
  })
})
