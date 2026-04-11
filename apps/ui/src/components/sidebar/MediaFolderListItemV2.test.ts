import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MediaFolderListItemV2 } from './MediaFolderListItemV2'
import { useDialogs } from '@/providers/dialog-provider'
import { useMediaMetadataStoreState } from '@/stores/mediaMetadataStore'
import { useMediaMetadataActions } from '@/actions/mediaMetadataActions'
import { useConfig } from '@/hooks/userConfig'

vi.mock('@/providers/dialog-provider')
vi.mock('@/stores/mediaMetadataStore')
vi.mock('@/actions/mediaMetadataActions')
vi.mock('@/hooks/userConfig')
vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

describe('MediaFolderListItemV2 openRenameForMediaFolder', () => {
  const path = '/media/tvshows/Old Name'
  const mediaName = 'Old Name'

  let mockOpenRenameForMediaFolder: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    mockOpenRenameForMediaFolder = vi.fn()
    vi.mocked(useDialogs).mockReturnValue({
      renameDialog: [vi.fn(), vi.fn(), mockOpenRenameForMediaFolder],
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
      mediaMetadatas: [],
      selectedMediaMetadata: null,
      selectedIndex: 0,
    } as unknown as ReturnType<typeof useMediaMetadataStoreState>)
    vi.mocked(useMediaMetadataActions).mockReturnValue({
      deleteMediaMetadata: vi.fn(),
      updateMediaMetadata: vi.fn(),
      refreshMediaMetadata: vi.fn(),
    } as unknown as ReturnType<typeof useMediaMetadataActions>)

    vi.mocked(useConfig).mockReturnValue({
      userConfig: { folders: [path] },
      setAndSaveUserConfig: vi.fn(),
    } as unknown as ReturnType<typeof useConfig>)
  })

  it('calls openRenameForMediaFolder with path and title/description', () => {
    render(
      React.createElement(MediaFolderListItemV2, { path, mediaName, mediaType: 'tvshow' })
    )

    const trigger = document.querySelector('[data-slot="context-menu-trigger"]')
    expect(trigger).toBeTruthy()
    fireEvent.contextMenu(trigger!)

    const renameItem = screen.getByTestId('context-menu-rename')
    fireEvent.click(renameItem)

    expect(mockOpenRenameForMediaFolder).toHaveBeenCalledTimes(1)
    expect(mockOpenRenameForMediaFolder).toHaveBeenCalledWith(path, {
      title: 'mediaFolder.renameTitle',
      description: 'mediaFolder.renameDescription',
    })
  })
})
