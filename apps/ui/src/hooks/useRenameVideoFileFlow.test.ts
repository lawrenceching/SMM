import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"

vi.mock("@/api/renameFiles", () => ({
  renameFiles: vi.fn().mockResolvedValue({}),
}))

vi.mock("@/providers/dialog-provider", () => ({
  useDialogs: vi.fn(),
}))

vi.mock("@/hooks/mediaMetadata/useFetchMediaMetadataMutation", () => ({
  useFetchMediaMetadataMutation: vi.fn(),
}))

vi.mock("@/components/episode-file", () => ({
  computeAssociatedFileRenames: vi.fn().mockReturnValue([]),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

import { renameFiles } from "@/api/renameFiles"
import { useDialogs } from "@/providers/dialog-provider"
import { useFetchMediaMetadataMutation } from "@/hooks/mediaMetadata/useFetchMediaMetadataMutation"
import { computeAssociatedFileRenames } from "@/components/episode-file"
import { toast } from "sonner"
import { useRenameVideoFileFlow } from "./useRenameVideoFileFlow"
import type { UIMediaFileDataRow } from "@/components/media/UIMediaFileTable"

// Test-only shapes — keep these as small as possible to make the dependency
// on the mocked modules explicit. The values are not validated; the cast only
// narrows what fields the test reads back from the mocks.
interface MockDialogContextValue {
  renameFileDialog: [ReturnType<typeof vi.fn>, ReturnType<typeof vi.fn>]
}
interface MockFetchMutation {
  mutateAsync: ReturnType<typeof vi.fn>
}

describe("useRenameVideoFileFlow", () => {
  const renameFilesMock = vi.mocked(renameFiles)
  const useDialogsMock = vi.mocked(useDialogs)
  const useFetchMock = vi.mocked(useFetchMediaMetadataMutation)
  const computeAssocMock = vi.mocked(computeAssociatedFileRenames)
  const toastSuccess = vi.mocked(toast.success)
  const toastError = vi.mocked(toast.error)

  const openRename = vi.fn()
  const fetchMediaMetadata = vi.fn().mockResolvedValue({})

  const mediaFolderPath = "/media/show"
  const files = [
    "/media/show/S01E01.mkv",
    "/media/show/S01E01.srt",
    "/media/show/S01E01.nfo",
  ]

  const baseRow: UIMediaFileDataRow = {
    season: 1,
    episode: 1,
    type: "episode",
    videoFile: "/media/show/S01E01.mkv",
    thumbnail: undefined,
    subtitle: "/media/show/S01E01.srt",
    nfo: "/media/show/S01E01.nfo",
    checked: false,
  }

  beforeEach(() => {
    renameFilesMock.mockReset()
    renameFilesMock.mockResolvedValue({})
    useDialogsMock.mockReset()
    useDialogsMock.mockReturnValue({
      renameFileDialog: [openRename, vi.fn()],
    } as unknown as MockDialogContextValue)
    useFetchMock.mockReset()
    useFetchMock.mockReturnValue({
      mutateAsync: fetchMediaMetadata,
    } as unknown as MockFetchMutation)
    computeAssocMock.mockReset()
    computeAssocMock.mockReturnValue([])
    toastSuccess.mockReset()
    toastError.mockReset()
    openRename.mockReset()
    fetchMediaMetadata.mockReset()
    fetchMediaMetadata.mockResolvedValue({})
  })

  it("is a no-op when the row has no videoFile", () => {
    const { result } = renderHook(() =>
      useRenameVideoFileFlow({ mediaFolderPath, files }),
    )

    act(() => {
      result.current.onRenameContextMenuClick({ ...baseRow, videoFile: undefined })
    })

    expect(openRename).not.toHaveBeenCalled()
  })

  it("is a no-op when mediaFolderPath is undefined", () => {
    const { result } = renderHook(() =>
      useRenameVideoFileFlow({ mediaFolderPath: undefined, files }),
    )

    act(() => {
      result.current.onRenameContextMenuClick(baseRow)
    })

    expect(openRename).not.toHaveBeenCalled()
  })

  it("opens the rename dialog with the relative path as initial value", () => {
    const { result } = renderHook(() =>
      useRenameVideoFileFlow({ mediaFolderPath, files }),
    )

    act(() => {
      result.current.onRenameContextMenuClick(baseRow)
    })

    expect(openRename).toHaveBeenCalledTimes(1)
    const call = openRename.mock.calls[0]!
    const options = call[1] as { initialValue?: string } | undefined
    expect(options?.initialValue).toBe("S01E01.mkv")
  })

  it("renames the video file plus associated files and refetches metadata on success", async () => {
    computeAssocMock.mockReturnValue([
      { from: "/media/show/S01E01.srt", to: "/media/show/S01E02.srt" },
    ])
    const onAfterRename = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useRenameVideoFileFlow({ mediaFolderPath, files, onAfterRename }),
    )

    let confirm!: (newRelativePath: string) => Promise<void>
    act(() => {
      result.current.onRenameContextMenuClick(baseRow)
    })
    confirm = openRename.mock.calls[0]![0]

    await act(async () => {
      await confirm("S01E02.mkv")
    })

    expect(computeAssocMock).toHaveBeenCalledWith(
      "/media/show/S01E01.mkv",
      "/media/show/S01E02.mkv",
      files,
    )
    expect(renameFilesMock).toHaveBeenCalledWith({
      files: [
        { from: "/media/show/S01E01.mkv", to: "/media/show/S01E02.mkv" },
        { from: "/media/show/S01E01.srt", to: "/media/show/S01E02.srt" },
      ],
    })
    expect(onAfterRename).toHaveBeenCalledTimes(1)
    expect(fetchMediaMetadata).toHaveBeenCalledWith({ path: mediaFolderPath })
    expect(toastSuccess).toHaveBeenCalledWith("episodeFile.renameSuccess")
    expect(toastError).not.toHaveBeenCalled()
  })

  it("toasts an error and rethrows when renameFiles fails", async () => {
    renameFilesMock.mockRejectedValueOnce(new Error("boom"))
    const onAfterRename = vi.fn()
    const { result } = renderHook(() =>
      useRenameVideoFileFlow({ mediaFolderPath, files, onAfterRename }),
    )

    let confirm!: (newRelativePath: string) => Promise<void>
    act(() => {
      result.current.onRenameContextMenuClick(baseRow)
    })
    confirm = openRename.mock.calls[0]![0]

    await expect(
      act(async () => {
        await confirm("S01E02.mkv")
      }),
    ).rejects.toThrow("boom")

    expect(onAfterRename).not.toHaveBeenCalled()
    expect(fetchMediaMetadata).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledWith("episodeFile.renameFailed", {
      description: "boom",
    })
    expect(toastSuccess).not.toHaveBeenCalled()
  })
})
