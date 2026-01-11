import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readMediaMetadataV2 } from './readMediaMetadataV2'
import type { MediaMetadata } from '@core/types'
import { FileNotFoundError } from '@core/errors'

// Mock the API functions
vi.mock('./hello', () => ({
  hello: vi.fn(),
}))

vi.mock('./readFile', () => ({
  readFile: vi.fn(),
}))

vi.mock('./listFiles', () => ({
  listFiles: vi.fn(),
}))

import { hello } from './hello'
import { readFile } from './readFile'
import { listFiles } from './listFiles'

describe('readMediaMetadataV2', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    consoleWarnSpy.mockRestore()
  })

  it('should return mediaMetadata with mediaFolderPath and files set in happy flow', async () => {
    const pathPosix = '/test/media/folder'
    const appDataDir = '/app/data'
    
    const mockMediaMetadata: MediaMetadata = {
      mediaFolderPath: pathPosix,
      files: [],
      mediaFiles: [],
      poster: undefined,
      tmdbTVShowId: undefined,
      seasons: undefined,
    }

    const mockFiles = [
      '/test/media/folder/video1.mp4',
      '/test/media/folder/video2.mkv',
      '/test/media/folder/subtitle.srt',
    ]

    // Mock hello() to return system config
    vi.mocked(hello).mockResolvedValue({
      uptime: 100,
      version: '1.0.0',
      userDataDir: '/user/data',
      appDataDir: appDataDir,
    })

    // Mock readFile() to return the media metadata file content
    vi.mocked(readFile).mockResolvedValue({
      data: JSON.stringify(mockMediaMetadata),
      error: undefined,
    })

    // Mock listFiles() to return the list of files
    vi.mocked(listFiles).mockResolvedValue({
      data: {
        path: pathPosix,
        items: mockFiles,
      },
      error: undefined,
    })

    const result = await readMediaMetadataV2(pathPosix)

    // Check that mediaFolderPath is set
    expect(result.mediaFolderPath).toBe(pathPosix)

    // Check that files is set
    expect(result.files).toBeDefined()
    expect(Array.isArray(result.files)).toBe(true)
    expect(result.files?.length).toBe(mockFiles.length)
    // Verify that files contains the expected paths (after Path.posix transformation)
    expect(result.files).toContain(mockFiles[0])
    expect(result.files).toContain(mockFiles[1])
    expect(result.files).toContain(mockFiles[2])
  })

  it('should return blank media metadata when readFile API call fails', async () => {
    const pathPosix = '/test/media/folder'
    const appDataDir = '/app/data'

    // Mock hello() to return system config
    vi.mocked(hello).mockResolvedValue({
      uptime: 100,
      version: '1.0.0',
      userDataDir: '/user/data',
      appDataDir: appDataDir,
    })

    // Mock readFile() to return FileNotFoundError
    vi.mocked(readFile).mockResolvedValue({
      data: undefined,
      error: `${FileNotFoundError}: /app/data/metadata/test_media_folder.json`,
    })

    // Mock listFiles() to return successfully (to isolate readFile failure)
    vi.mocked(listFiles).mockResolvedValue({
      data: {
        path: pathPosix,
        items: ['/test/media/folder/video1.mp4'],
      },
      error: undefined,
    })

    const result = await readMediaMetadataV2(pathPosix)

    // Check that blank media metadata was returned
    expect(result.mediaFolderPath).toBe(pathPosix)
    expect(result.files).toBeDefined()
    expect(Array.isArray(result.files)).toBe(true)
    // Files should be set from listFiles, not from readFile
    expect(result.files?.length).toBe(1)
    expect(result.mediaFiles).toEqual([])
    expect(result.poster).toBeUndefined()
    expect(result.tmdbTVShowId).toBeUndefined()
    expect(result.seasons).toBeUndefined()
  })

  it('should return blank media metadata when listFiles API call fails', async () => {
    const pathPosix = '/test/media/folder'
    const appDataDir = '/app/data'

    // Mock hello() to return system config
    vi.mocked(hello).mockResolvedValue({
      uptime: 100,
      version: '1.0.0',
      userDataDir: '/user/data',
      appDataDir: appDataDir,
    })

    // Mock readFile() to return FileNotFoundError (blank metadata scenario)
    vi.mocked(readFile).mockResolvedValue({
      data: undefined,
      error: `${FileNotFoundError}: /app/data/metadata/test_media_folder.json`,
    })

    vi.mocked(listFiles).mockResolvedValue({
      data: undefined,
      error: 'Some error occurred',
    })

    const result = await readMediaMetadataV2(pathPosix)

    // Check that blank media metadata was returned (files should be empty array)
    expect(result.mediaFolderPath).toBe(pathPosix)
    expect(result.files).toBeDefined()
    expect(Array.isArray(result.files)).toBe(true)
    // Files should be empty array when listFiles fails
    expect(result.files?.length).toBe(0)
    expect(result.mediaFiles).toEqual([])
    expect(result.poster).toBeUndefined()
    expect(result.tmdbTVShowId).toBeUndefined()
    expect(result.seasons).toBeUndefined()
  })

  it('should log unexpected response body error when readFile returns non-FileNotFoundError', async () => {
    const pathPosix = '/test/media/folder'
    const appDataDir = '/app/data'
    const unexpectedError = 'Permission denied: /app/data/metadata/test_media_folder.json'

    // Mock hello() to return system config
    vi.mocked(hello).mockResolvedValue({
      uptime: 100,
      version: '1.0.0',
      userDataDir: '/user/data',
      appDataDir: appDataDir,
    })

    // Mock readFile() to return a non-FileNotFoundError error
    vi.mocked(readFile).mockResolvedValue({
      data: undefined,
      error: unexpectedError,
    })

    // Mock listFiles() to return successfully
    vi.mocked(listFiles).mockResolvedValue({
      data: {
        path: pathPosix,
        items: ['/test/media/folder/video1.mp4'],
      },
      error: undefined,
    })

    const result = await readMediaMetadataV2(pathPosix)

    // Check that console.error was called with unexpected response body message
    // Note: When there's an error AND no data, both error conditions are logged
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `[readMediaMetadataV2] unexpected response body: ${unexpectedError}`
    )
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `[readMediaMetadataV2] unexpected response body: no data`
    )

    // Check that blank media metadata was returned
    expect(result.mediaFolderPath).toBe(pathPosix)
    expect(result.files).toBeDefined()
    expect(Array.isArray(result.files)).toBe(true)
    expect(result.files?.length).toBe(1)
    expect(result.mediaFiles).toEqual([])
    expect(result.poster).toBeUndefined()
    expect(result.tmdbTVShowId).toBeUndefined()
    expect(result.seasons).toBeUndefined()
  })

  it('should log unexpected response body error when readFile returns no data', async () => {
    const pathPosix = '/test/media/folder'
    const appDataDir = '/app/data'

    // Mock hello() to return system config
    vi.mocked(hello).mockResolvedValue({
      uptime: 100,
      version: '1.0.0',
      userDataDir: '/user/data',
      appDataDir: appDataDir,
    })

    // Mock readFile() to return no data (data is undefined)
    vi.mocked(readFile).mockResolvedValue({
      data: undefined,
      error: undefined,
    })

    // Mock listFiles() to return successfully
    vi.mocked(listFiles).mockResolvedValue({
      data: {
        path: pathPosix,
        items: ['/test/media/folder/video1.mp4'],
      },
      error: undefined,
    })

    const result = await readMediaMetadataV2(pathPosix)

    // Check that console.error was called with "no data" message
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[readMediaMetadataV2] unexpected response body: no data')
    )

    // Check that blank media metadata was returned
    expect(result.mediaFolderPath).toBe(pathPosix)
    expect(result.files).toBeDefined()
    expect(Array.isArray(result.files)).toBe(true)
    expect(result.files?.length).toBe(1)
    expect(result.mediaFiles).toEqual([])
    expect(result.poster).toBeUndefined()
    expect(result.tmdbTVShowId).toBeUndefined()
    expect(result.seasons).toBeUndefined()
  })

  it('should log unexpected response body error when readFile returns empty string data', async () => {
    const pathPosix = '/test/media/folder'
    const appDataDir = '/app/data'

    // Mock hello() to return system config
    vi.mocked(hello).mockResolvedValue({
      uptime: 100,
      version: '1.0.0',
      userDataDir: '/user/data',
      appDataDir: appDataDir,
    })

    // Mock readFile() to return empty string data
    vi.mocked(readFile).mockResolvedValue({
      data: '',
      error: undefined,
    })

    // Mock listFiles() to return successfully
    vi.mocked(listFiles).mockResolvedValue({
      data: {
        path: pathPosix,
        items: ['/test/media/folder/video1.mp4'],
      },
      error: undefined,
    })

    const result = await readMediaMetadataV2(pathPosix)

    // Check that console.error was called with "no data" message
    // (empty string is falsy, so it triggers the "no data" error)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[readMediaMetadataV2] unexpected response body: no data')
    )

    // Check that blank media metadata was returned
    expect(result.mediaFolderPath).toBe(pathPosix)
    expect(result.files).toBeDefined()
    expect(Array.isArray(result.files)).toBe(true)
    expect(result.files?.length).toBe(1)
    expect(result.mediaFiles).toEqual([])
    expect(result.poster).toBeUndefined()
    expect(result.tmdbTVShowId).toBeUndefined()
    expect(result.seasons).toBeUndefined()
  })
})
