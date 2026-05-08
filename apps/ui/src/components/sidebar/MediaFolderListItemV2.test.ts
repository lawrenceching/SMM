import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MediaFolderListItemV2 } from './MediaFolderListItemV2'
vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

describe('MediaFolderListItemV2 context menu callbacks', () => {
  const path = '/media/tvshows/Old Name'
  const mediaName = 'Old Name'

  let onRename: ReturnType<typeof vi.fn>
  let onDelete: ReturnType<typeof vi.fn>
  let onOpenInExplorer: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    onRename = vi.fn()
    onDelete = vi.fn()
    onOpenInExplorer = vi.fn()
  })

  it('calls callback props from context menu actions', () => {
    render(
      React.createElement(MediaFolderListItemV2, {
        path,
        mediaName,
        mediaType: 'tvshow',
        onRename,
        onDelete,
        onOpenInExplorer,
      })
    )

    const trigger = document.querySelector('[data-slot="context-menu-trigger"]')
    expect(trigger).toBeTruthy()
    fireEvent.contextMenu(trigger!)

    const renameItem = screen.getByTestId('context-menu-rename')
    fireEvent.click(renameItem)
    expect(onRename).toHaveBeenCalledTimes(1)

    fireEvent.contextMenu(trigger!)
    const openInExplorerItem = screen.getByTestId('context-menu-open-in-explorer')
    fireEvent.click(openInExplorerItem)
    expect(onOpenInExplorer).toHaveBeenCalledTimes(1)

    fireEvent.contextMenu(trigger!)
    const deleteItem = screen.getByTestId('context-menu-delete')
    fireEvent.click(deleteItem)
    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})

describe("MediaFolderListItemV2 folder_not_found status", () => {
  const path = "/media/tvshows/Missing"
  const mediaName = "Missing Show"

  it("renders warning icon with aria-label from translation key", () => {
    render(
      React.createElement(MediaFolderListItemV2, {
        path,
        mediaName,
        mediaType: "tvshow",
        status: "folder_not_found",
      }),
    )

    expect(screen.getByLabelText("mediaFolder.folderNotFound")).toBeInTheDocument()
  })

  it("applies muted disabled-style classes on media title and folder name", () => {
    render(
      React.createElement(MediaFolderListItemV2, {
        path,
        mediaName,
        mediaType: "tvshow",
        status: "folder_not_found",
      }),
    )

    const title = screen.getByTestId("sidebar-folder-title")
    const folderNameEl = screen.getByTestId("sidebar-folder-name")

    expect(title).toHaveClass("text-muted-foreground")
    expect(title).toHaveClass("opacity-60")
    expect(folderNameEl).toHaveClass("text-muted-foreground")
    expect(folderNameEl).toHaveClass("opacity-50")
  })

  it("does not show loading spinner when status is folder_not_found", () => {
    render(
      React.createElement(MediaFolderListItemV2, {
        path,
        mediaName,
        mediaType: "tvshow",
        status: "folder_not_found",
      }),
    )

    expect(document.querySelector(".animate-spin")).toBeNull()
  })

  it("still fires onClick on the row when folder_not_found (visual-only disabled state)", () => {
    const onClick = vi.fn()
    render(
      React.createElement(MediaFolderListItemV2, {
        path,
        mediaName,
        mediaType: "tvshow",
        status: "folder_not_found",
        onClick,
      }),
    )

    const trigger = document.querySelector('[data-slot="context-menu-trigger"]')
    expect(trigger).toBeTruthy()
    fireEvent.click(trigger!)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
