import { describe, it, expect, vi, beforeEach } from 'vitest'
import { doRenameFolder, type DoRenameFolderDeps } from './doRenameFolder'
import type { UIMediaMetadata } from '@/types/UIMediaMetadata'

describe('doRenameFolder', () => {
  const path = '/media/tvshows/Old Name'
  const newName = 'New Name'
  const newFolderPath = '/media/tvshows/New Name'

  let deps: DoRenameFolderDeps

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    deps = {
      renameFolderApi: vi.fn().mockResolvedValue(undefined),
      deleteMediaMetadata: vi.fn(),
      updateMediaMetadata: vi.fn(),
      refreshMediaMetadata: vi.fn().mockResolvedValue(undefined),
    }
  })

  it('calls renameFolderApi with from and to paths', async () => {
    const metadata = minimalMetadata(path)

    await doRenameFolder(path, newName, metadata, deps)

    expect(deps.renameFolderApi).toHaveBeenCalledTimes(1)
    expect(deps.renameFolderApi).toHaveBeenCalledWith({
      from: path,
      to: newFolderPath,
    })
  })

  it('calls deleteMediaMetadata with old path when path changed', async () => {
    const metadata = minimalMetadata(path)

    await doRenameFolder(path, newName, metadata, deps)

    expect(deps.deleteMediaMetadata).toHaveBeenCalledTimes(1)
    expect(deps.deleteMediaMetadata).toHaveBeenCalledWith(path, { traceId: expect.any(String) })
  })

  it('calls updateMediaMetadata with new path and updated metadata', async () => {
    const metadata = minimalMetadata(path)

    await doRenameFolder(path, newName, metadata, deps)

    expect(deps.updateMediaMetadata).toHaveBeenCalledTimes(1)
    expect(deps.updateMediaMetadata).toHaveBeenCalledWith(
      newFolderPath,
      expect.objectContaining({
        mediaFolderPath: newFolderPath,
        mediaName: newName,
      }),
      expect.objectContaining({ traceId: expect.any(String) })
    )
  })

  it('calls refreshMediaMetadata with new folder path', async () => {
    const metadata = minimalMetadata(path)

    await doRenameFolder(path, newName, metadata, deps)

    expect(deps.refreshMediaMetadata).toHaveBeenCalledTimes(1)
    expect(deps.refreshMediaMetadata).toHaveBeenCalledWith(newFolderPath)
  })

  it('updates tvShow.name when metadata has tvShow', async () => {
    const metadata: UIMediaMetadata = {
      ...minimalMetadata(path),
      tvShow: {
        id: '123',
        name: 'Old Show Name',
        database: 'TMDB',
        seasons: [],
      },
    }

    await doRenameFolder(path, newName, metadata, deps)

    expect(deps.updateMediaMetadata).toHaveBeenCalledWith(
      newFolderPath,
      expect.objectContaining({
        mediaFolderPath: newFolderPath,
        tvShow: expect.objectContaining({
          id: '123',
          name: newName,
          database: 'TMDB',
          seasons: [],
        }),
      }),
      expect.any(Object)
    )
  })

  it('updates movie.name when metadata has movie', async () => {
    const metadata: UIMediaMetadata = {
      ...minimalMetadata(path),
      type: 'movie-folder',
      movie: {
        id: '456',
        name: 'Old Movie Title',
        database: 'TMDB',
      },
    }

    await doRenameFolder(path, newName, metadata, deps)

    expect(deps.updateMediaMetadata).toHaveBeenCalledWith(
      newFolderPath,
      expect.objectContaining({
        mediaFolderPath: newFolderPath,
        movie: expect.objectContaining({
          id: '456',
          name: newName,
          database: 'TMDB',
        }),
      }),
      expect.any(Object)
    )
  })

  it('updates mediaName when no tvShow or movie', async () => {
    const metadata = minimalMetadata(path)

    await doRenameFolder(path, newName, metadata, deps)

    const call = vi.mocked(deps.updateMediaMetadata).mock.calls[0]
    expect(call[1]).toMatchObject({
      mediaFolderPath: newFolderPath,
      mediaName: newName,
    })
  })

  it('uses provided traceId in updateMediaMetadata options', async () => {
    const metadata = minimalMetadata(path)
    const traceId = 'custom-trace-123'

    await doRenameFolder(path, newName, metadata, deps, traceId)

    expect(deps.updateMediaMetadata).toHaveBeenCalledWith(
      newFolderPath,
      expect.any(Object),
      { traceId }
    )
  })

  it('throws and logs when renameFolderApi fails', async () => {
    const metadata = minimalMetadata(path)
    const apiError = new Error('Network error')
    vi.mocked(deps.renameFolderApi).mockRejectedValue(apiError)

    await expect(doRenameFolder(path, newName, metadata, deps)).rejects.toThrow(
      'Network error'
    )

    expect(console.error).toHaveBeenCalledWith('Failed to rename folder:', apiError)
    expect(deps.deleteMediaMetadata).not.toHaveBeenCalled()
    expect(deps.updateMediaMetadata).not.toHaveBeenCalled()
    expect(deps.refreshMediaMetadata).not.toHaveBeenCalled()
  })

  it('does not call deleteMediaMetadata when path equals newFolderPath', async () => {
    const metadata = minimalMetadata(path)
    const samePath = '/media/tvshows/Old Name'
    await doRenameFolder(samePath, 'Old Name', metadata, deps)

    expect(deps.deleteMediaMetadata).not.toHaveBeenCalled()
  })
})

function minimalMetadata(mediaFolderPath: string): UIMediaMetadata {
  return {
    mediaFolderPath,
    mediaName: 'Old Name',
    status: 'ok',
    type: 'tvshow-folder',
  } as UIMediaMetadata
}
