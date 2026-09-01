import { describe, it, expect, vi, beforeEach } from "vitest"
import { createElement } from "react"
import { render } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const { persistHarmonyOSFileAccessMock } = vi.hoisted(() => ({
  persistHarmonyOSFileAccessMock: vi.fn(),
}))

const { importFolderViaCoreMock } = vi.hoisted(() => ({
  importFolderViaCoreMock: vi.fn(),
}))

vi.mock("@/lib/persistHarmonyOSFileAccess", () => ({
  persistHarmonyOSFileAccess: persistHarmonyOSFileAccessMock,
}))

vi.mock("@/api/importFolder", () => ({
  importFolderViaCore: importFolderViaCoreMock,
}))

import { ImportFolderEventHandler } from "./ImportFolderEventHandler"
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore"
import { UI_ImportFolderEvent, type OnMediaFolderImportedEventData } from "@/types/eventTypes"

describe("ImportFolderEventHandler", () => {
  function renderHandler() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(ImportFolderEventHandler),
      ),
    )
  }

  beforeEach(() => {
    importFolderViaCoreMock.mockReset()
    persistHarmonyOSFileAccessMock.mockReset()
    persistHarmonyOSFileAccessMock.mockResolvedValue(undefined)
    useUIMediaFolderStore.setState({
      folders: [],
      selectedFolder: "",
      selectedFolders: [],
    })
  })

  it("upserts initializing folder and POSTs /api/import-folder", async () => {
    importFolderViaCoreMock.mockResolvedValue("core-job-1")
    const folderPath = "/media/tvshow/Show A"

    renderHandler()

    document.dispatchEvent(
      new CustomEvent(UI_ImportFolderEvent, {
        detail: {
          folderPathInPlatformFormat: folderPath,
          type: "tvshow",
          traceId: "test-trace",
        } satisfies OnMediaFolderImportedEventData,
      }),
    )

    await vi.waitFor(() => {
      expect(importFolderViaCoreMock).toHaveBeenCalledWith({
        path: folderPath,
        type: "tvshow",
        traceId: "test-trace",
      })
    })

    expect(persistHarmonyOSFileAccessMock).toHaveBeenCalledWith([folderPath])

    const state = useUIMediaFolderStore.getState()
    expect(state.selectedFolder).toBe(folderPath)
    expect(state.folders).toEqual([
      { path: folderPath, status: "initializing", type: "tvshow-folder" },
    ])
  })

  it("skips optimistic UI when skipOptimisticUpdate is true", async () => {
    importFolderViaCoreMock.mockResolvedValue("core-job-1")
    const folderPath = "/media/movie/Movie A"

    renderHandler()

    document.dispatchEvent(
      new CustomEvent(UI_ImportFolderEvent, {
        detail: {
          folderPathInPlatformFormat: folderPath,
          type: "movie",
          skipOptimisticUpdate: true,
        } satisfies OnMediaFolderImportedEventData,
      }),
    )

    await vi.waitFor(() => {
      expect(importFolderViaCoreMock).toHaveBeenCalled()
    })

    const state = useUIMediaFolderStore.getState()
    expect(state.folders).toEqual([])
    expect(state.selectedFolder).toBe("")
  })

  it("marks folder as error when import-folder fails", async () => {
    importFolderViaCoreMock.mockRejectedValue(new Error("Error Reason: boom"))
    const folderPath = "/media/music/Album"

    renderHandler()

    document.dispatchEvent(
      new CustomEvent(UI_ImportFolderEvent, {
        detail: {
          folderPathInPlatformFormat: folderPath,
          type: "music",
        } satisfies OnMediaFolderImportedEventData,
      }),
    )

    await vi.waitFor(() => {
      expect(useUIMediaFolderStore.getState().folders[0]?.status).toBe("error_loading_metadata")
    })
  })
})
