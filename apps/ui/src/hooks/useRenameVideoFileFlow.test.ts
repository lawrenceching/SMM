import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"

vi.mock("@/api/renameEpisodeFile", () => ({
  renameEpisodeFileViaCore: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/hooks/mediaMetadata/useFetchMediaMetadataMutation", () => ({
  useFetchMediaMetadataMutation: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

import { renameEpisodeFileViaCore } from "@/api/renameEpisodeFile"
import { useFetchMediaMetadataMutation } from "@/hooks/mediaMetadata/useFetchMediaMetadataMutation"
import { toast } from "sonner"
import { useRenameVideoFileFlow } from "./useRenameVideoFileFlow"
import type { UIMediaFileDataRow } from "@/components/media/UIMediaFileTable"

interface MockFetchMutation {
  mutateAsync: ReturnType<typeof vi.fn>
}

describe("useRenameVideoFileFlow", () => {
  const renameViaCoreMock = vi.mocked(renameEpisodeFileViaCore)
  const useFetchMock = vi.mocked(useFetchMediaMetadataMutation)
  const toastSuccess = vi.mocked(toast.success)
  const toastError = vi.mocked(toast.error)

  const openRename = vi.fn()
  const fetchMediaMetadata = vi.fn().mockResolvedValue({})

  const mediaFolderPath = "/media/show"

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
    renameViaCoreMock.mockReset()
    renameViaCoreMock.mockResolvedValue(undefined)
    useFetchMock.mockReset()
    useFetchMock.mockReturnValue({
      mutateAsync: fetchMediaMetadata,
    } as unknown as MockFetchMutation)
    toastSuccess.mockReset()
    toastError.mockReset()
    openRename.mockReset()
    fetchMediaMetadata.mockReset()
    fetchMediaMetadata.mockResolvedValue({})
  })

  it("is a no-op when the row has no videoFile", () => {
    const { result } = renderHook(() =>
      useRenameVideoFileFlow({ mediaFolderPath, openRenameDialog: openRename }),
    )

    act(() => {
      result.current.onRenameContextMenuClick({ ...baseRow, videoFile: undefined })
    })

    expect(openRename).not.toHaveBeenCalled()
  })

  it("is a no-op when mediaFolderPath is undefined", () => {
    const { result } = renderHook(() =>
      useRenameVideoFileFlow({ mediaFolderPath: undefined, openRenameDialog: openRename }),
    )

    act(() => {
      result.current.onRenameContextMenuClick(baseRow)
    })

    expect(openRename).not.toHaveBeenCalled()
  })

  it("opens the rename dialog with the relative path as initial value", () => {
    const { result } = renderHook(() =>
      useRenameVideoFileFlow({ mediaFolderPath, openRenameDialog: openRename }),
    )

    act(() => {
      result.current.onRenameContextMenuClick(baseRow)
    })

    expect(openRename).toHaveBeenCalledTimes(1)
    const call = openRename.mock.calls[0]!
    const options = call[1] as { initialValue?: string } | undefined
    expect(options?.initialValue).toBe("S01E01.mkv")
  })

  it("renames the video file via Core and refetches metadata on success", async () => {
    const onAfterRename = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useRenameVideoFileFlow({
        mediaFolderPath,
        onAfterRename,
        openRenameDialog: openRename,
      }),
    )

    act(() => {
      result.current.onRenameContextMenuClick(baseRow)
    })
    const confirm = openRename.mock.calls[0]![0] as (newRelativePath: string) => Promise<void>

    await act(async () => {
      await confirm("S01E02.mkv")
    })

    expect(renameViaCoreMock).toHaveBeenCalledWith({
      mediaFolder: "/media/show",
      from: "/media/show/S01E01.mkv",
      to: "/media/show/S01E02.mkv",
    })
    expect(onAfterRename).toHaveBeenCalledTimes(1)
    expect(fetchMediaMetadata).toHaveBeenCalledWith({ path: mediaFolderPath })
    expect(toastSuccess).toHaveBeenCalledWith("episodeFile.renameSuccess")
    expect(toastError).not.toHaveBeenCalled()
  })

  it("toasts an error and rethrows when renameEpisodeFileViaCore fails", async () => {
    renameViaCoreMock.mockRejectedValueOnce(new Error("boom"))
    const onAfterRename = vi.fn()
    const { result } = renderHook(() =>
      useRenameVideoFileFlow({
        mediaFolderPath,
        onAfterRename,
        openRenameDialog: openRename,
      }),
    )

    act(() => {
      result.current.onRenameContextMenuClick(baseRow)
    })
    const confirm = openRename.mock.calls[0]![0] as (newRelativePath: string) => Promise<void>

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
