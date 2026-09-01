import { describe, it, expect, vi, beforeEach } from 'vitest'
import { initializeMusicFolder } from './initializeMusicFolder'

vi.mock('@/lib/mediaMetadataUtils', () => ({
  createInitialMediaMetadata: vi.fn(),
}))

import { createInitialMediaMetadata } from '@/lib/mediaMetadataUtils'

describe('initializeMusicFolder', () => {
  const mockAddMediaFolderInUserConfig = vi.fn()
  const mockGetMediaMetadata = vi.fn()
  const mockAddMediaMetadata = vi.fn()
  const traceId = 'test-trace-id'

  const fullMetadata = {
    mediaFolderPath: '/media/music/Album',
    type: 'music-folder',
    status: 'ok',
    files: ['/media/music/Album/song1.mp3'],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createInitialMediaMetadata).mockResolvedValue(fullMetadata as never)
  })

  it('should add folder to user config', async () => {
    const folderPath = '/media/music/Album'
    mockGetMediaMetadata.mockReturnValue(undefined)

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
    mockGetMediaMetadata.mockReturnValue(undefined)

    await initializeMusicFolder(folderPath, {
      addMediaFolderInUserConfig: mockAddMediaFolderInUserConfig,
      getMediaMetadata: mockGetMediaMetadata,
      addMediaMetadata: mockAddMediaMetadata,
      traceId,
    })

    expect(createInitialMediaMetadata).toHaveBeenCalledWith(folderPath, 'music-folder', {
      traceId,
    })
    expect(mockAddMediaMetadata).toHaveBeenCalledWith(fullMetadata)
  })

  it('should not create media metadata when folder already exists', async () => {
    const folderPath = '/media/music/ExistingAlbum'
    const posixPath = '/media/music/ExistingAlbum'
    mockGetMediaMetadata.mockReturnValue({
      mediaFolderPath: posixPath,
      type: 'music-folder',
      status: 'ok',
    })

    await initializeMusicFolder(folderPath, {
      addMediaFolderInUserConfig: mockAddMediaFolderInUserConfig,
      getMediaMetadata: mockGetMediaMetadata,
      addMediaMetadata: mockAddMediaMetadata,
      traceId,
    })

    expect(createInitialMediaMetadata).not.toHaveBeenCalled()
    expect(mockAddMediaMetadata).not.toHaveBeenCalled()
  })

  it('should update placeholder to full metadata when folder is initializing', async () => {
    const folderPath = '/media/music/ExistingAlbum'
    const posixPath = '/media/music/ExistingAlbum'
    mockGetMediaMetadata.mockReturnValue({
      mediaFolderPath: posixPath,
      type: 'music-folder',
      status: 'initializing',
    })
    const mockUpdateMediaMetadata = vi.fn().mockResolvedValue(undefined)

    await initializeMusicFolder(folderPath, {
      addMediaFolderInUserConfig: mockAddMediaFolderInUserConfig,
      getMediaMetadata: mockGetMediaMetadata,
      addMediaMetadata: mockAddMediaMetadata,
      updateMediaMetadata: mockUpdateMediaMetadata,
      isInitializing: () => true,
      traceId,
    })

    expect(createInitialMediaMetadata).toHaveBeenCalledWith(folderPath, 'music-folder', {
      traceId,
    })
    expect(mockAddMediaMetadata).not.toHaveBeenCalled()
    expect(mockUpdateMediaMetadata).toHaveBeenCalledWith(posixPath, fullMetadata)
  })

  it('should convert folder path to POSIX format when checking for existing metadata', async () => {
    const folderPath = 'C:\\media\\music\\Album'
    mockGetMediaMetadata.mockReturnValue(undefined)

    await initializeMusicFolder(folderPath, {
      addMediaFolderInUserConfig: mockAddMediaFolderInUserConfig,
      getMediaMetadata: mockGetMediaMetadata,
      addMediaMetadata: mockAddMediaMetadata,
      traceId,
    })

    expect(mockGetMediaMetadata).toHaveBeenCalledWith('/C/media/music/Album')
  })

  it('should pass traceId to createInitialMediaMetadata', async () => {
    const folderPath = '/media/music/Album'
    mockGetMediaMetadata.mockReturnValue(undefined)

    await initializeMusicFolder(folderPath, {
      addMediaFolderInUserConfig: mockAddMediaFolderInUserConfig,
      getMediaMetadata: mockGetMediaMetadata,
      addMediaMetadata: mockAddMediaMetadata,
      traceId,
    })

    expect(createInitialMediaMetadata).toHaveBeenCalledWith(folderPath, 'music-folder', {
      traceId,
    })
  })

  it('should add the media metadata returned for the folder', async () => {
    const folderPath = '/media/music/Album'
    const metadata = {
      mediaFolderPath: folderPath,
      type: 'music-folder',
      status: 'ok' as const,
      files: [
        '/media/music/Album/song1.mp3',
        '/media/music/Album/song2.mp3',
        '/media/music/Album/song3.mp3',
      ],
    }
    vi.mocked(createInitialMediaMetadata).mockResolvedValue(metadata as never)
    mockGetMediaMetadata.mockReturnValue(undefined)

    await initializeMusicFolder(folderPath, {
      addMediaFolderInUserConfig: mockAddMediaFolderInUserConfig,
      getMediaMetadata: mockGetMediaMetadata,
      addMediaMetadata: mockAddMediaMetadata,
      traceId,
    })

    expect(mockAddMediaMetadata).toHaveBeenCalledWith(metadata)
  })
})
