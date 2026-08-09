import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"
import { useSyncWatchedFolder } from "./useSyncWatchedFolder"
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore"
import * as api from "@/api/setWatchedFolder"

vi.mock("@/api/setWatchedFolder", () => ({
  setWatchedFolder: vi.fn(() => Promise.resolve({ data: { watchedFolder: null } })),
}))

describe("useSyncWatchedFolder", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useUIMediaFolderStore.setState({
      folders: [],
      selectedFolder: "",
      selectedFolders: [],
    })
  })

  it("calls API with null when nothing is selected", async () => {
    renderHook(() => useSyncWatchedFolder())
    await waitFor(() => {
      expect(api.setWatchedFolder).toHaveBeenCalledWith(null, expect.any(AbortSignal))
    })
  })

  it("calls API when selectedFolder changes", async () => {
    renderHook(() => useSyncWatchedFolder())
    act(() => {
      useUIMediaFolderStore.getState().setSelectedFolder("/media/ShowA")
    })
    await waitFor(() => {
      expect(api.setWatchedFolder).toHaveBeenCalledWith("/media/ShowA", expect.any(AbortSignal))
    })
  })

  it("aborts previous request on rapid change", async () => {
    const signals: AbortSignal[] = []
    vi.mocked(api.setWatchedFolder).mockImplementation((_path, signal) => {
      if (signal) signals.push(signal)
      return Promise.resolve({ data: { watchedFolder: _path } })
    })

    renderHook(() => useSyncWatchedFolder())
    act(() => {
      useUIMediaFolderStore.getState().setSelectedFolder("/media/A")
    })
    act(() => {
      useUIMediaFolderStore.getState().setSelectedFolder("/media/B")
    })

    await waitFor(() => {
      expect(api.setWatchedFolder).toHaveBeenCalledWith("/media/B", expect.any(AbortSignal))
    })
    expect(signals.some((s) => s.aborted)).toBe(true)
  })
})
