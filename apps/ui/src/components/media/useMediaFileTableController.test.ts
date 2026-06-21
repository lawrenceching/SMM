import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"

vi.mock("@/api/openFile", () => ({
  openFile: vi.fn(),
}))

vi.mock("@/providers/dialog-provider", () => ({
  useDialogs: vi.fn(),
}))

import { openFile as openFileApi } from "@/api/openFile"
import { useDialogs } from "@/providers/dialog-provider"
import { useMediaFileTableController } from "./useMediaFileTableController"
import type {
  UIMediaFileDataRow,
  UIMediaFileFolderRow,
} from "./UIMediaFileTable"

describe("useMediaFileTableController", () => {
  const openFileApiMock = vi.mocked(openFileApi)
  const useDialogsMock = vi.mocked(useDialogs)
  const openMediaFileProperty = vi.fn()

  beforeEach(() => {
    openFileApiMock.mockReset()
    openFileApiMock.mockResolvedValue({ data: { path: "" } })
    openMediaFileProperty.mockReset()
    useDialogsMock.mockReset()
    useDialogsMock.mockReturnValue({
      mediaFilePropertyDialog: [openMediaFileProperty, vi.fn()],
    } as unknown as ReturnType<typeof useDialogs>)
  })

  it("openFile resolves the path against mediaFolderPath, converts to platform, and calls openFile API", () => {
    const { result } = renderHook(() =>
      useMediaFileTableController("/media/show"),
    )

    act(() => {
      result.current.openFile("Season 01/S01E01.mkv")
    })

    expect(openFileApiMock).toHaveBeenCalledTimes(1)
    const calledWith = openFileApiMock.mock.calls[0]?.[0] ?? ""
    expect(calledWith).toMatch(/Season 01[\\/]S01E01\.mkv$/)
  })

  it("openFile leaves absolute paths untouched apart from platform conversion", () => {
    const { result } = renderHook(() =>
      useMediaFileTableController("/media/show"),
    )

    act(() => {
      result.current.openFile("/abs/path/clip.mkv")
    })

    const calledWith = openFileApiMock.mock.calls[0]?.[0] ?? ""
    expect(calledWith.endsWith("clip.mkv")).toBe(true)
    // The path segment should appear unchanged (modulo platform separators)
    expect(calledWith).toContain("abs")
    expect(calledWith).toContain("path")
  })

  it("openFile is a no-op when mediaFolderPath is undefined and the path is relative", () => {
    const { result } = renderHook(() =>
      useMediaFileTableController(undefined),
    )

    act(() => {
      result.current.openFile("relative.mkv")
    })

    expect(openFileApiMock).not.toHaveBeenCalled()
  })

  it("openPropertiesDialog opens the property dialog with the resolved path", () => {
    const { result } = renderHook(() =>
      useMediaFileTableController("/media/show"),
    )

    act(() => {
      result.current.openPropertiesDialog("S01E01.mkv")
    })

    expect(openMediaFileProperty).toHaveBeenCalledTimes(1)
    const passed = openMediaFileProperty.mock.calls[0]?.[0] as {
      filePath: string
    }
    expect(passed.filePath).toMatch(/S01E01\.mkv$/)
  })

  it("handleDoubleClick opens videoFile on data rows", () => {
    const { result } = renderHook(() =>
      useMediaFileTableController("/media/show"),
    )
    const row: UIMediaFileDataRow = {
      season: 1,
      episode: 1,
      type: "episode",
      videoFile: "S01E01.mkv",
      thumbnail: undefined,
      subtitle: undefined,
      nfo: undefined,
      checked: false,
    }

    act(() => {
      result.current.handleDoubleClick(row)
    })

    expect(openFileApiMock).toHaveBeenCalledWith(
      expect.stringMatching(/S01E01\.mkv$/),
    )
  })

  it("handleDoubleClick opens path on folder file rows", () => {
    const { result } = renderHook(() =>
      useMediaFileTableController("/media/show"),
    )
    const row: UIMediaFileFolderRow = {
      id: "fanart",
      type: "folderFile",
      path: "fanart.jpg",
    }

    act(() => {
      result.current.handleDoubleClick(row)
    })

    expect(openFileApiMock).toHaveBeenCalledWith(
      expect.stringMatching(/fanart\.jpg$/),
    )
  })

  it("handleDoubleClick is a no-op when data row has no videoFile", () => {
    const { result } = renderHook(() =>
      useMediaFileTableController("/media/show"),
    )
    const row: UIMediaFileDataRow = {
      season: 1,
      episode: 1,
      type: "episode",
      videoFile: undefined,
      thumbnail: undefined,
      subtitle: undefined,
      nfo: undefined,
      checked: false,
    }

    act(() => {
      result.current.handleDoubleClick(row)
    })

    expect(openFileApiMock).not.toHaveBeenCalled()
  })
})
