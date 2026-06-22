import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, cleanup } from "@testing-library/react"
import type {
  UIMediaFileDataContextMenuItem,
  UIMediaFileDataRow,
  UIMediaFileTableContextMenuConfig,
  UIMediaFileTableRow,
} from "./UIMediaFileTable"

// Capture the latest contextMenuConfig the wrapper passes to the underlying
// pure UI component, so the test can assert against it without rendering
// the real table (which depends on UI primitives that need Radix portals).
let lastContextMenuConfig: UIMediaFileTableContextMenuConfig | undefined

vi.mock("./UIMediaFileTable", () => ({
  UIMediaFileTable: (
    props: { contextMenuConfig?: UIMediaFileTableContextMenuConfig } & Record<string, unknown>,
  ) => {
    lastContextMenuConfig = props.contextMenuConfig
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
  checked: false,
}

const data: UIMediaFileTableRow[] = [baseRow]

beforeEach(() => {
  cleanup()
  lastContextMenuConfig = undefined
})

describe("MediaFileTable right-click menu", () => {
  it("exposes only the built-in Open and Properties items by default", () => {
    render(<MediaFileTable data={data} mediaFolderPath="/media/show" />)

    const items = lastContextMenuConfig?.dataRowItems ?? []
    expect(items.map((i) => i.id)).toEqual(["open", "properties"])
  })

  it("appends caller-provided extraEpisodeContextMenu items after Open and Properties", () => {
    const renameClick = vi.fn()
    const extra: UIMediaFileDataContextMenuItem[] = [
      {
        id: "rename",
        label: "Rename",
        onClick: renameClick,
        disabled: (row) => !row.videoFile,
      },
    ]

    render(
      <MediaFileTable
        data={data}
        mediaFolderPath="/media/show"
        extraEpisodeContextMenu={extra}
      />,
    )

    const items = lastContextMenuConfig?.dataRowItems ?? []
    expect(items.map((i) => i.id)).toEqual(["open", "properties", "rename"])
    expect(items[2]?.onClick).toBe(renameClick)
  })

  it("extra item's disabled predicate runs against the row and toggles per row", () => {
    const extra: UIMediaFileDataContextMenuItem[] = [
      {
        id: "rename",
        label: "Rename",
        onClick: vi.fn(),
        disabled: (row) => !row.videoFile,
      },
    ]

    render(
      <MediaFileTable
        data={data}
        mediaFolderPath="/media/show"
        extraEpisodeContextMenu={extra}
      />,
    )

    const items = lastContextMenuConfig?.dataRowItems ?? []
    const rename = items.find((i) => i.id === "rename")
    if (!rename) throw new Error("expected rename item")
    const isDisabled = rename.disabled
    if (typeof isDisabled !== "function") {
      throw new Error("expected function-form disabled on rename item")
    }
    expect(isDisabled(baseRow)).toBe(false)
    expect(isDisabled({ ...baseRow, videoFile: undefined })).toBe(true)
  })

  it("does not leak extraEpisodeContextMenu into folder file rows", () => {
    const extra: UIMediaFileDataContextMenuItem[] = [
      { id: "rename", label: "Rename", onClick: vi.fn() },
    ]

    render(
      <MediaFileTable
        data={data}
        mediaFolderPath="/media/show"
        extraEpisodeContextMenu={extra}
      />,
    )

    // folderFileRowItems is independent — designed to skip data-row-only entries
    expect(lastContextMenuConfig?.folderFileRowItems?.map((i) => i.id)).toEqual(["open"])
  })
})
