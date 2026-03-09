import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MediaFolderListItemV2, doRenameFolder, type DoRenameFolderDeps } from './MediaFolderListItemV2'
import type { UIMediaMetadata } from '@/types/UIMediaMetadata'
import { useDialogs } from '@/providers/dialog-provider'
import { useMediaMetadataStoreState, useMediaMetadataStoreActions } from '@/stores/mediaMetadataStore'
import { useMediaMetadataActions } from '@/actions/mediaMetadataActions'
import { useConfig } from '@/providers/config-provider'
import { renameFolder } from '@/api/renameFolder'
import { toast } from 'sonner'

vi.mock('@/providers/dialog-provider')
vi.mock('@/stores/mediaMetadataStore')
vi.mock('@/actions/mediaMetadataActions')
vi.mock('@/providers/config-provider')
vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { error?: string }) =>
      opts?.error != null ? `Could not rename: ${opts.error}` : key,
  }),
}))
vi.mock('@/api/renameFolder')
vi.mock('sonner')

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

  it('updates tmdbTvShow.name when metadata has tmdbTvShow', async () => {
    const metadata: UIMediaMetadata = {
      ...minimalMetadata(path),
      tmdbTvShow: {
        id: 123,
        name: 'Old Show Name',
        first_air_date: '2020-01-01',
      } as UIMediaMetadata['tmdbTvShow'],
    }

    await doRenameFolder(path, newName, metadata, deps)

    expect(deps.updateMediaMetadata).toHaveBeenCalledWith(
      newFolderPath,
      expect.objectContaining({
        mediaFolderPath: newFolderPath,
        tmdbTvShow: expect.objectContaining({
          id: 123,
          name: newName,
          first_air_date: '2020-01-01',
        }),
      }),
      expect.any(Object)
    )
  })

  it('updates tmdbMovie.title when metadata has tmdbMovie', async () => {
    const metadata: UIMediaMetadata = {
      ...minimalMetadata(path),
      tmdbMovie: {
        id: 456,
        title: 'Old Movie Title',
        release_date: '2021-06-15',
      } as UIMediaMetadata['tmdbMovie'],
    }

    await doRenameFolder(path, newName, metadata, deps)

    expect(deps.updateMediaMetadata).toHaveBeenCalledWith(
      newFolderPath,
      expect.objectContaining({
        mediaFolderPath: newFolderPath,
        tmdbMovie: expect.objectContaining({
          id: 456,
          title: newName,
          release_date: '2021-06-15',
        }),
      }),
      expect.any(Object)
    )
  })

  it('updates mediaName when no tmdbTvShow or tmdbMovie', async () => {
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
    // Same name as current folder basename -> same path
    const samePath = '/media/tvshows/Old Name'
    await doRenameFolder(samePath, 'Old Name', metadata, deps)

    expect(deps.deleteMediaMetadata).not.toHaveBeenCalled()
  })
})

describe('openRenameDialog onRename callback', () => {
  const path = '/media/tvshows/Old Name'
  const mediaName = 'Old Name'

  let mockOpenRenameDialog: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    mockOpenRenameDialog = vi.fn()
    vi.mocked(useDialogs).mockReturnValue({
      renameDialog: [mockOpenRenameDialog, vi.fn()],
      filePropertyDialog: [vi.fn(), vi.fn()],
      formatConverterDialog: [vi.fn(), vi.fn()],
      downloadVideoDialog: [vi.fn(), vi.fn()],
      confirmationDialog: [vi.fn(), vi.fn()],
      spinnerDialog: [vi.fn(), vi.fn()],
      configDialog: [vi.fn(), vi.fn()],
      openFolderDialog: [vi.fn(), vi.fn()],
      filePickerDialog: [vi.fn(), vi.fn()],
      mediaSearchDialog: [vi.fn(), vi.fn()],
      scrapeDialog: [vi.fn(), vi.fn()],
    } as unknown as ReturnType<typeof useDialogs>)

    vi.mocked(useMediaMetadataStoreState).mockReturnValue({
      mediaMetadatas: [minimalMetadata(path)],
      selectedMediaMetadata: null,
      selectedIndex: 0,
    } as unknown as ReturnType<typeof useMediaMetadataStoreState>)
    vi.mocked(useMediaMetadataStoreActions).mockReturnValue({
      getMediaMetadata: vi.fn(() => minimalMetadata(path)),
      setMediaMetadatas: vi.fn(),
      addMediaMetadata: vi.fn(),
      updateMediaMetadata: vi.fn(),
      removeMediaMetadata: vi.fn(),
      updateMediaMetadataStatus: vi.fn(),
      setSelectedIndex: vi.fn(),
      setSelectedByMediaFolderPath: vi.fn(),
    } as unknown as ReturnType<typeof useMediaMetadataStoreActions>)
    vi.mocked(useMediaMetadataActions).mockReturnValue({
      deleteMediaMetadata: vi.fn(),
      updateMediaMetadata: vi.fn(),
      refreshMediaMetadata: vi.fn(),
    } as unknown as ReturnType<typeof useMediaMetadataActions>)

    vi.mocked(useConfig).mockReturnValue({
      userConfig: { folders: [path] },
      setAndSaveUserConfig: vi.fn(),
    } as unknown as ReturnType<typeof useConfig>)

    vi.mocked(renameFolder).mockRejectedValue(new Error('API error'))
    vi.mocked(toast.error).mockImplementation(() => 'toast-id')
  })

  it('calls toast.error when doRenameFolder throws', async () => {
    render(
      React.createElement(MediaFolderListItemV2, { path, mediaName, mediaType: 'tvshow' })
    )

    const trigger = document.querySelector('[data-slot="context-menu-trigger"]')
    expect(trigger).toBeTruthy()
    fireEvent.contextMenu(trigger!)

    const renameItem = screen.getByTestId('context-menu-rename')
    fireEvent.click(renameItem)

    expect(mockOpenRenameDialog).toHaveBeenCalledTimes(1)
    const onRename = mockOpenRenameDialog.mock.calls[0][0] as (newName: string) => Promise<void>

    await onRename('New Name')

    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledWith('Could not rename: API error')
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
