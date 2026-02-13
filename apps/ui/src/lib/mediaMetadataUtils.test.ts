import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createInitialMediaMetadata } from './mediaMetadataUtils'

vi.mock('@/api/listFiles', () => ({
  listFiles: vi.fn(),
}))

import { listFiles } from '@/api/listFiles'

describe('createInitialMediaMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return metadata with mediaFolderPath, status, and files not undefined', async () => {
    const folderPath = '/media/tvshows/Test Show'
    const mockFiles = [
      '/media/tvshows/Test Show/episode1.mkv',
      '/media/tvshows/Test Show/episode2.mkv',
    ]

    vi.mocked(listFiles).mockResolvedValue({
      data: {
        path: folderPath,
        items: mockFiles.map(path => ({
          path,
          size: 0,
          mtime: 0,
          isDirectory: false,
        })),
        size: mockFiles.length,
      },
      error: undefined,
    })

    const result = await createInitialMediaMetadata(folderPath)

    expect(result.mediaFolderPath).toBeDefined()
    expect(result.mediaFolderPath).toBe(folderPath)
    expect(result.status).toBeDefined()
    expect(result.status).toBe('idle')
    expect(result.files).toBeDefined()
    expect(result.files).toEqual(mockFiles)
  })

  it('should throw error when listFiles API returns error', async () => {
    const folderPath = '/media/tvshows/Test Show'

    vi.mocked(listFiles).mockResolvedValue({
      data: undefined,
      error: 'Permission denied',
    })

    await expect(createInitialMediaMetadata(folderPath)).rejects.toThrow('Failed to list files: Permission denied')
  })

  it('should throw error when listFiles API returns undefined data', async () => {
    const folderPath = '/media/tvshows/Test Show'

    vi.mocked(listFiles).mockResolvedValue({
      data: undefined,
      error: undefined,
    })

    await expect(createInitialMediaMetadata(folderPath)).rejects.toThrow('Failed to list files: response.data is undefined')
  })

  it('should convert Windows local file paths to POSIX format', async () => {
    const folderPath = 'C:\\media\\tvshows\\Test Show'
    const mockWindowsFiles = [
      'C:\\media\\tvshows\\Test Show\\episode1.mkv',
      'C:\\media\\tvshows\\Test Show\\episode2.mkv',
    ]
    const expectedPosixFiles = [
      '/C/media/tvshows/Test Show/episode1.mkv',
      '/C/media/tvshows/Test Show/episode2.mkv',
    ]

    vi.mocked(listFiles).mockResolvedValue({
      data: {
        path: folderPath,
        items: mockWindowsFiles.map(path => ({
          path,
          size: 0,
          mtime: 0,
          isDirectory: false,
        })),
        size: mockWindowsFiles.length,
      },
      error: undefined,
    })

    const result = await createInitialMediaMetadata(folderPath)

    expect(result.mediaFolderPath).toBeDefined()
    expect(result.mediaFolderPath).toBe('/C/media/tvshows/Test Show')
    expect(result.status).toBeDefined()
    expect(result.status).toBe('idle')
    expect(result.files).toBeDefined()
    expect(result.files).toEqual(expectedPosixFiles)
  })

  it('should convert Windows network paths to POSIX format', async () => {
    const folderPath = '\\\\nas.local\\share\\media\\tvshows\\Test Show'
    const mockNetworkFiles = [
      '\\\\nas.local\\share\\media\\tvshows\\Test Show\\episode1.mkv',
      '\\\\nas.local\\share\\media\\tvshows\\Test Show\\episode2.mkv',
    ]
    const expectedPosixFiles = [
      '/nas.local/share/media/tvshows/Test Show/episode1.mkv',
      '/nas.local/share/media/tvshows/Test Show/episode2.mkv',
    ]

    vi.mocked(listFiles).mockResolvedValue({
      data: {
        path: folderPath,
        items: mockNetworkFiles.map(path => ({
          path,
          size: 0,
          mtime: 0,
          isDirectory: false,
        })),
        size: mockNetworkFiles.length,
      },
      error: undefined,
    })

    const result = await createInitialMediaMetadata(folderPath)

    expect(result.mediaFolderPath).toBeDefined()
    expect(result.mediaFolderPath).toBe('/nas.local/share/media/tvshows/Test Show')
    expect(result.status).toBeDefined()
    expect(result.status).toBe('idle')
    expect(result.files).toBeDefined()
    expect(result.files).toEqual(expectedPosixFiles)
  })
})
