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

const { pollImportFolderJobMock } = vi.hoisted(() => ({
  pollImportFolderJobMock: vi.fn(),
}))

const { showFolderViaCoreMock } = vi.hoisted(() => ({
  showFolderViaCoreMock: vi.fn(),
}))

const { invalidateFoldersQueryMock } = vi.hoisted(() => ({
  invalidateFoldersQueryMock: vi.fn(),
}))

vi.mock("@/lib/persistHarmonyOSFileAccess", () => ({
  persistHarmonyOSFileAccess: persistHarmonyOSFileAccessMock,
}))

vi.mock("@/api/importFolder", () => ({
  importFolderViaCore: importFolderViaCoreMock,
}))

vi.mock("@/lib/pollImportFolderJob", () => ({
  pollImportFolderJob: pollImportFolderJobMock,
}))

vi.mock("@/api/showFolder", () => ({
  showFolderViaCore: showFolderViaCoreMock,
}))

vi.mock("@/hooks/folders", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/folders")>()
  return {
    ...actual,
    invalidateFoldersQuery: invalidateFoldersQueryMock,
  }
})

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
    return queryClient
  }

  beforeEach(() => {
    importFolderViaCoreMock.mockReset()
    persistHarmonyOSFileAccessMock.mockReset()
    persistHarmonyOSFileAccessMock.mockResolvedValue(undefined)
    pollImportFolderJobMock.mockReset()
    showFolderViaCoreMock.mockReset()
    invalidateFoldersQueryMock.mockReset()
    useUIMediaFolderStore.setState({
      folders: [],
      selectedFolder: "",
      selectedFolders: [],
    })
  })

  it("upserts initializing folder and POSTs /api/import-folder", async () => {
    importFolderViaCoreMock.mockResolvedValue("core-job-1")
    pollImportFolderJobMock.mockResolvedValue({
      kind: "import",
      id: "core-job-1",
      folderPath: "/media/tvshow/Show A",
      type: "tvshow",
      status: "succeeded",
      stage: "persist",
      progress: 100,
      createdAt: 0,
      updatedAt: 0,
    })
    showFolderViaCoreMock.mockResolvedValue({
      path: "/media/tvshow/Show A",
      status: "ok",
      type: "tvshow-folder",
      title: "Show A",
    })
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

    await vi.waitFor(() => {
      expect(pollImportFolderJobMock).toHaveBeenCalledWith("core-job-1", expect.any(Function))
    })

    await vi.waitFor(() => {
      expect(showFolderViaCoreMock).toHaveBeenCalledWith(folderPath)
    })

    await vi.waitFor(() => {
      expect(useUIMediaFolderStore.getState().folders).toEqual([
        { path: folderPath, status: "ok", type: "tvshow-folder" },
      ])
    })

    expect(invalidateFoldersQueryMock).toHaveBeenCalled()
  })

  it("skips optimistic UI when skipOptimisticUpdate is true", async () => {
    importFolderViaCoreMock.mockResolvedValue("core-job-1")
    pollImportFolderJobMock.mockResolvedValue({
      kind: "import",
      id: "core-job-1",
      folderPath: "/media/movie/Movie A",
      type: "movie",
      status: "succeeded",
      stage: "persist",
      progress: 100,
      createdAt: 0,
      updatedAt: 0,
    })
    showFolderViaCoreMock.mockResolvedValue({
      path: "/media/movie/Movie A",
      status: "ok",
      type: "movie-folder",
    })
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

    await vi.waitFor(() => {
      expect(showFolderViaCoreMock).toHaveBeenCalled()
    })

    const state = useUIMediaFolderStore.getState()
    // No optimistic insert before import; final showFolder still upserts.
    expect(state.folders).toEqual([
      { path: folderPath, status: "ok", type: "movie-folder" },
    ])
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

  it("marks folder as error when import job fails", async () => {
    importFolderViaCoreMock.mockResolvedValue("core-job-1")
    pollImportFolderJobMock.mockResolvedValue({
      kind: "import",
      id: "core-job-1",
      folderPath: "/media/tvshow/Show A",
      type: "tvshow",
      status: "failed",
      stage: "recognize",
      progress: 40,
      error: "Error Reason: tmdb down",
      createdAt: 0,
      updatedAt: 0,
    })
    const folderPath = "/media/tvshow/Show A"

    renderHandler()

    document.dispatchEvent(
      new CustomEvent(UI_ImportFolderEvent, {
        detail: {
          folderPathInPlatformFormat: folderPath,
          type: "tvshow",
        } satisfies OnMediaFolderImportedEventData,
      }),
    )

    await vi.waitFor(() => {
      expect(useUIMediaFolderStore.getState().folders[0]?.status).toBe("error_loading_metadata")
    })
    expect(showFolderViaCoreMock).not.toHaveBeenCalled()
  })
})
