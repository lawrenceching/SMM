import { describe, it, expect, vi, beforeEach } from 'vitest'
import { doRenameFolder, type DoRenameFolderDeps } from './doRenameFolder'
import type { UIMediaMetadata } from '@/types/UIMediaMetadata'
import { normalizeMediaFolderPathForQuery } from '@/lib/mediaMetadataQueryKeys'

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
      writePersistedMetadata: vi.fn().mockResolvedValue(undefined),
      removeQueryDataForPath: vi.fn(),
      addMediaMetadataToStore: vi.fn(),
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

  it('calls removeQueryDataForPath with old path when path changed', async () => {
    const metadata = minimalMetadata(path)

    await doRenameFolder(path, newName, metadata, deps)

    expect(deps.removeQueryDataForPath).toHaveBeenCalledTimes(1)
    expect(deps.removeQueryDataForPath).toHaveBeenCalledWith(path)
  })

  it('calls writePersistedMetadata with normalized new path and updated metadata', async () => {
    const metadata = minimalMetadata(path)

    await doRenameFolder(path, newName, metadata, deps)

    expect(deps.writePersistedMetadata).toHaveBeenCalledTimes(1)
    expect(deps.writePersistedMetadata).toHaveBeenCalledWith(
      normalizeMediaFolderPathForQuery(newFolderPath),
      expect.objectContaining({
        mediaFolderPath: newFolderPath,
      }),
      expect.any(String)
    )
  })

  it('calls addMediaMetadataToStore with updated metadata', async () => {
    const metadata = minimalMetadata(path)

    await doRenameFolder(path, newName, metadata, deps)

    expect(deps.addMediaMetadataToStore).toHaveBeenCalledTimes(1)
    expect(deps.addMediaMetadataToStore).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaFolderPath: newFolderPath,
      })
    )
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

    expect(deps.writePersistedMetadata).toHaveBeenCalledWith(
      normalizeMediaFolderPathForQuery(newFolderPath),
      expect.objectContaining({
        mediaFolderPath: newFolderPath,
        tvShow: expect.objectContaining({
          id: '123',
          name: newName,
          database: 'TMDB',
          seasons: [],
        }),
      }),
      expect.any(String)
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

    expect(deps.writePersistedMetadata).toHaveBeenCalledWith(
      normalizeMediaFolderPathForQuery(newFolderPath),
      expect.objectContaining({
        mediaFolderPath: newFolderPath,
        movie: expect.objectContaining({
          id: '456',
          name: newName,
          database: 'TMDB',
        }),
      }),
      expect.any(String)
    )
  })

  it('does not add legacy mediaName when no tvShow or movie', async () => {
    const metadata = minimalMetadata(path)

    await doRenameFolder(path, newName, metadata, deps)

    const call = vi.mocked(deps.writePersistedMetadata).mock.calls[0]
    expect(call[1]).toMatchObject({
      mediaFolderPath: newFolderPath,
    })
    expect(call[1]).not.toHaveProperty('mediaName')
  })

  it('uses provided traceId in writePersistedMetadata', async () => {
    const metadata = minimalMetadata(path)
    const traceId = 'custom-trace-123'

    await doRenameFolder(path, newName, metadata, deps, traceId)

    expect(deps.writePersistedMetadata).toHaveBeenCalledWith(
      normalizeMediaFolderPathForQuery(newFolderPath),
      expect.any(Object),
      traceId
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
    expect(deps.removeQueryDataForPath).not.toHaveBeenCalled()
    expect(deps.writePersistedMetadata).not.toHaveBeenCalled()
    expect(deps.addMediaMetadataToStore).not.toHaveBeenCalled()
  })

  it('does not call deleteMediaMetadata or removeQueryDataForPath when path equals newFolderPath', async () => {
    const metadata = minimalMetadata(path)
    const samePath = '/media/tvshows/Old Name'
    await doRenameFolder(samePath, 'Old Name', metadata, deps)

    expect(deps.deleteMediaMetadata).not.toHaveBeenCalled()
    expect(deps.removeQueryDataForPath).not.toHaveBeenCalled()
    expect(deps.writePersistedMetadata).toHaveBeenCalled()
    expect(deps.addMediaMetadataToStore).toHaveBeenCalled()
  })
})

function minimalMetadata(mediaFolderPath: string): UIMediaMetadata {
  return {
    mediaFolderPath,
    status: 'ok',
    type: 'tvshow-folder',
  } as UIMediaMetadata
}
