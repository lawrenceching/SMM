import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, cleanup } from "@testing-library/react"
import type {
  MediaFileTableContextMenuProps,
  UIMediaFileDataRow,
  UIMediaFileTableRow,
} from "./UIMediaFileTable"

// Capture the latest contextMenuProps the wrapper passes to the underlying
// pure UI component, so the test can assert against it without rendering
// the real table (which depends on UI primitives that need Radix portals).
let lastContextMenuProps: MediaFileTableContextMenuProps | undefined

vi.mock("./UIMediaFileTable", () => ({
  UIMediaFileTable: (
    props: { contextMenuProps?: MediaFileTableContextMenuProps } & Record<string, unknown>,
  ) => {
    lastContextMenuProps = props.contextMenuProps
    return <div data-testid="ui-media-file-table" />
  },
}))

vi.mock("@/api/openFile", () => ({
  openFile: vi.fn(),
}))

vi.mock("@/providers/dialog-provider", () => ({
  useDialogs: vi.fn(() => ({
    mediaFilePropertyDialog: [vi.fn(), vi.fn()],
  })),
}))

import { MediaFileTable } from "./MediaFileTable"

const baseRow: UIMediaFileDataRow = {
  season: 1,
  episode: 1,
  type: "episode",
  videoFile: "/media/show/S01E01.mkv",
  thumbnail: undefined,
  subtitle: undefined,
  nfo: undefined,
}

const data: UIMediaFileTableRow[] = [baseRow]

beforeEach(() => {
  cleanup()
  lastContextMenuProps = undefined
})

describe("MediaFileTable right-click menu", () => {
  it("passes contextMenuProps with Open and Properties handlers by default", () => {
    render(<MediaFileTable data={data} mediaFolderPath="/media/show" />)

    expect(lastContextMenuProps).toBeDefined()
    expect(lastContextMenuProps?.onOpenMenuClick).toBeTypeOf("function")
    expect(lastContextMenuProps?.onPropertiesMenuClick).toBeTypeOf("function")
  })

  it("forwards caller-provided contextMenuProps", () => {
    const renameClick = vi.fn()

    render(
      <MediaFileTable
        data={data}
        mediaFolderPath="/media/show"
        contextMenuProps={{
          renameMenuVisible: true,
          onRenameMenuClick: renameClick,
        }}
      />,
    )

    expect(lastContextMenuProps?.renameMenuVisible).toBe(true)
    expect(lastContextMenuProps?.onRenameMenuClick).toBe(renameClick)
  })

  it("defaults Open/Properties handlers to ctrl.openFile/openPropertiesDialog", () => {
    render(<MediaFileTable data={data} mediaFolderPath="/media/show" />)

    // Open handler should call openFile when videoFile is present
    const openHandler = lastContextMenuProps?.onOpenMenuClick
    expect(openHandler).toBeDefined()
    // Properties handler should call openPropertiesDialog when videoFile is present
    const propsHandler = lastContextMenuProps?.onPropertiesMenuClick
    expect(propsHandler).toBeDefined()
  })
})
