import { describe, it, expect, vi, beforeEach } from 'vitest'
import { initializeMusicFolder } from './initializeMusicFolder'

vi.mock('@/api/listFiles', () => ({
  listFiles: vi.fn(),
}))

vi.mock('@core/mediaMetadata', () => ({
  createMediaMetadata: vi.fn(),
}))

import { listFiles } from '@/api/listFiles'
import { createMediaMetadata } from '@core/mediaMetadata'
import type { MediaMetadata } from '@core/types'

describe('initializeMusicFolder', () => {
  const mockAddMediaFolderInUserConfig = vi.fn()
  const mockGetMediaMetadata = vi.fn()
  const mockAddMediaMetadata = vi.fn()
  const traceId = 'test-trace-id'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should add folder to user config', async () => {
    const folderPath = '/media/music/Album'

    mockGetMediaMetadata.mockReturnValue(undefined)
    vi.mocked(listFiles).mockResolvedValue({
      data: {
        path: folderPath,
        items: [
          { path: '/media/music/Album/song1.mp3', size: 0, mtime: 0, isDirectory: false },
          { path: '/media/music/Album/song2.mp3', size: 0, mtime: 0, isDirectory: false },
        ],
        size: 2,
      },
      error: undefined,
    })
    vi.mocked(createMediaMetadata).mockReturnValue({
      mediaFolderPath: '/media/music/Album',
      type: 'music-folder',
    })

    await initializeMusicFolder(folderPath, {
      addMediaFolderInUserConfig: mockAddMediaFolderInUserConfig,
      getMediaMetadata: mockGetMediaMetadata,
      addMediaMetadata: mockAddMediaMetadata,
      traceId,
    })

    expect(mockAddMediaFolderInUserConfig).toHaveBeenCalledWith(traceId, folderPath)
  })

  it('should create new media metadata when folder does not exist', async () => {
    const folderPath = '/media/music/NewAlbum'
    const posixPath = '/media/music/NewAlbum'

    mockGetMediaMetadata.mockReturnValue(undefined)
    vi.mocked(listFiles).mockResolvedValue({
      data: {
        path: folderPath,
        items: [
          { path: '/media/music/NewAlbum/song1.mp3', size: 0, mtime: 0, isDirectory: false },
        ],
        size: 1,
      },
      error: undefined,
    })
    vi.mocked(createMediaMetadata).mockReturnValue({
      mediaFolderPath: posixPath,
      type: 'music-folder',
    })

    await initializeMusicFolder(folderPath, {
      addMediaFolderInUserConfig: mockAddMediaFolderInUserConfig,
      getMediaMetadata: mockGetMediaMetadata,
      addMediaMetadata: mockAddMediaMetadata,
      traceId,
    })

    expect(mockAddMediaMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaFolderPath: posixPath,
        type: 'music-folder',
        status: 'ok',
        files: ['/media/music/NewAlbum/song1.mp3'],
      })
    )
  })

  it('should not create media metadata when folder already exists', async () => {
    const folderPath = '/media/music/ExistingAlbum'
    const posixPath = '/media/music/ExistingAlbum'

    const existingMetadata: MediaMetadata = {
      mediaFolderPath: posixPath,
      type: 'music-folder',
    }

    mockGetMediaMetadata.mockReturnValue(existingMetadata)

    await initializeMusicFolder(folderPath, {
      addMediaFolderInUserConfig: mockAddMediaFolderInUserConfig,
      getMediaMetadata: mockGetMediaMetadata,
      addMediaMetadata: mockAddMediaMetadata,
      traceId,
    })

    expect(mockAddMediaMetadata).not.toHaveBeenCalled()
  })

  it('should convert folder path to POSIX format when checking for existing metadata', async () => {
    const folderPath = 'C:\\media\\music\\Album'
    const posixPath = '/C/media/music/Album'

    mockGetMediaMetadata.mockReturnValue(undefined)
    vi.mocked(listFiles).mockResolvedValue({
      data: {
        path: folderPath,
        items: [],
        size: 0,
      },
      error: undefined,
    })
    vi.mocked(createMediaMetadata).mockReturnValue({
      mediaFolderPath: posixPath,
      type: 'music-folder',
    })

    await initializeMusicFolder(folderPath, {
      addMediaFolderInUserConfig: mockAddMediaFolderInUserConfig,
      getMediaMetadata: mockGetMediaMetadata,
      addMediaMetadata: mockAddMediaMetadata,
      traceId,
    })

    expect(mockGetMediaMetadata).toHaveBeenCalledWith(posixPath)
  })

  it('should pass traceId to createInitialMediaMetadata', async () => {
    const folderPath = '/media/music/Album'

    mockGetMediaMetadata.mockReturnValue(undefined)
    vi.mocked(listFiles).mockResolvedValue({
      data: {
        path: folderPath,
        items: [],
        size: 0,
      },
      error: undefined,
    })
    vi.mocked(createMediaMetadata).mockReturnValue({
      mediaFolderPath: '/media/music/Album',
      type: 'music-folder',
    })

    await initializeMusicFolder(folderPath, {
      addMediaFolderInUserConfig: mockAddMediaFolderInUserConfig,
      getMediaMetadata: mockGetMediaMetadata,
      addMediaMetadata: mockAddMediaMetadata,
      traceId,
    })

    expect(listFiles).toHaveBeenCalledWith(
      { path: folderPath, recursively: true, onlyFiles: true },
      undefined
    )
  })

  it('should handle multiple files in music folder', async () => {
    const folderPath = '/media/music/Album'

    mockGetMediaMetadata.mockReturnValue(undefined)
    vi.mocked(listFiles).mockResolvedValue({
      data: {
        path: folderPath,
        items: [
          { path: '/media/music/Album/song1.mp3', size: 0, mtime: 0, isDirectory: false },
          { path: '/media/music/Album/song2.mp3', size: 0, mtime: 0, isDirectory: false },
          { path: '/media/music/Album/song3.mp3', size: 0, mtime: 0, isDirectory: false },
        ],
        size: 3,
      },
      error: undefined,
    })
    vi.mocked(createMediaMetadata).mockReturnValue({
      mediaFolderPath: '/media/music/Album',
      type: 'music-folder',
    })

    await initializeMusicFolder(folderPath, {
      addMediaFolderInUserConfig: mockAddMediaFolderInUserConfig,
      getMediaMetadata: mockGetMediaMetadata,
      addMediaMetadata: mockAddMediaMetadata,
      traceId,
    })

    expect(mockAddMediaMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        files: [
          '/media/music/Album/song1.mp3',
          '/media/music/Album/song2.mp3',
          '/media/music/Album/song3.mp3',
        ],
      })
    )
  })

  it('should handle Windows network paths', async () => {
    const folderPath = '\\\\server\\share\\music\\Album'
    const posixPath = '/server/share/music/Album'

    mockGetMediaMetadata.mockReturnValue(undefined)
    vi.mocked(listFiles).mockResolvedValue({
      data: {
        path: folderPath,
        items: [],
        size: 0,
      },
      error: undefined,
    })
    vi.mocked(createMediaMetadata).mockReturnValue({
      mediaFolderPath: posixPath,
      type: 'music-folder',
    })

    await initializeMusicFolder(folderPath, {
      addMediaFolderInUserConfig: mockAddMediaFolderInUserConfig,
      getMediaMetadata: mockGetMediaMetadata,
      addMediaMetadata: mockAddMediaMetadata,
      traceId,
    })

    expect(mockGetMediaMetadata).toHaveBeenCalledWith(posixPath)
  })

  it('should set status to ok in mediaMetadataProps', async () => {
    const folderPath = '/media/music/Album'

    mockGetMediaMetadata.mockReturnValue(undefined)
    vi.mocked(listFiles).mockResolvedValue({
      data: {
        path: folderPath,
        items: [],
        size: 0,
      },
      error: undefined,
    })
    vi.mocked(createMediaMetadata).mockReturnValue({
      mediaFolderPath: '/media/music/Album',
      type: 'music-folder',
    })

    await initializeMusicFolder(folderPath, {
      addMediaFolderInUserConfig: mockAddMediaFolderInUserConfig,
      getMediaMetadata: mockGetMediaMetadata,
      addMediaMetadata: mockAddMediaMetadata,
      traceId,
    })

    expect(mockAddMediaMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ok',
      })
    )
  })

  it('should log appropriate message for new folder', async () => {
    const folderPath = '/media/music/NewAlbum'
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    mockGetMediaMetadata.mockReturnValue(undefined)
    vi.mocked(listFiles).mockResolvedValue({
      data: {
        path: folderPath,
        items: [],
        size: 0,
      },
      error: undefined,
    })
    vi.mocked(createMediaMetadata).mockReturnValue({
      mediaFolderPath: '/media/music/NewAlbum',
      type: 'music-folder',
    })

    await initializeMusicFolder(folderPath, {
      addMediaFolderInUserConfig: mockAddMediaFolderInUserConfig,
      getMediaMetadata: mockGetMediaMetadata,
      addMediaMetadata: mockAddMediaMetadata,
      traceId,
    })

    expect(consoleSpy).toHaveBeenCalledWith(
      `[${traceId}] add "${folderPath}" to user config`
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      `[${traceId}] Imported music folder and create media metadata for folder "${folderPath}"`
    )

    consoleSpy.mockRestore()
  })

  it('should log appropriate message for existing folder', async () => {
    const folderPath = '/media/music/ExistingAlbum'
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const existingMetadata: MediaMetadata = {
      mediaFolderPath: '/media/music/ExistingAlbum',
      type: 'music-folder',
    }

    mockGetMediaMetadata.mockReturnValue(existingMetadata)

    await initializeMusicFolder(folderPath, {
      addMediaFolderInUserConfig: mockAddMediaFolderInUserConfig,
      getMediaMetadata: mockGetMediaMetadata,
      addMediaMetadata: mockAddMediaMetadata,
      traceId,
    })

    expect(consoleSpy).toHaveBeenCalledWith(
      `[${traceId}] add "${folderPath}" to user config`
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      `[${traceId}] Imported music folder "${folderPath}" and skip creating media metadata because it already exists`
    )

    consoleSpy.mockRestore()
  })
})
