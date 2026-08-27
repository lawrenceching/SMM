import { describe, it, expect, vi, beforeEach } from "vitest"
import { createElement } from "react"
import { render } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const { persistHarmonyOSFileAccessMock } = vi.hoisted(() => ({
  persistHarmonyOSFileAccessMock: vi.fn(),
}))

const { importLibraryViaCoreMock } = vi.hoisted(() => ({
  importLibraryViaCoreMock: vi.fn(),
}))

const { pollImportLibraryJobMock, buildUiFoldersFromShowFolderMock } = vi.hoisted(() => ({
  pollImportLibraryJobMock: vi.fn(),
  buildUiFoldersFromShowFolderMock: vi.fn(),
}))

const { refreshUserConfigMock } = vi.hoisted(() => ({
  refreshUserConfigMock: vi.fn().mockResolvedValue(undefined),
}))

const { addJobMock, updateJobMock } = vi.hoisted(() => ({
  addJobMock: vi.fn(() => "job-1"),
  updateJobMock: vi.fn(),
}))

vi.mock("@/lib/persistHarmonyOSFileAccess", () => ({
  persistHarmonyOSFileAccess: persistHarmonyOSFileAccessMock,
}))

vi.mock("@/api/importLibrary", () => ({
  importLibraryViaCore: importLibraryViaCoreMock,
}))

vi.mock("@/lib/importLibraryV3", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/importLibraryV3")>()
  return {
    ...actual,
    pollImportLibraryJob: pollImportLibraryJobMock,
    buildUiFoldersFromShowFolder: buildUiFoldersFromShowFolderMock,
  }
})

vi.mock("@/hooks/userConfig", () => ({
  useRefreshUserConfig: () => refreshUserConfigMock,
}))

vi.mock("@/hooks/useJobManager", () => ({
  useJobManager: () => ({
    addJob: addJobMock,
    updateJob: updateJobMock,
  }),
}))

import { MediaLibraryImportedEventHandler } from "./MediaLibraryImportedEventHandler"
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore"
import { UI_MediaLibraryImportedEvent, type OnMediaLibraryImportedEventData } from "@/types/eventTypes"

describe("MediaLibraryImportedEventHandler", () => {
  function renderHandler() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(MediaLibraryImportedEventHandler),
      ),
    )
  }

  beforeEach(() => {
    importLibraryViaCoreMock.mockReset()
    pollImportLibraryJobMock.mockReset()
    buildUiFoldersFromShowFolderMock.mockReset()
    refreshUserConfigMock.mockReset()
    refreshUserConfigMock.mockResolvedValue(undefined)
    persistHarmonyOSFileAccessMock.mockReset()
    persistHarmonyOSFileAccessMock.mockResolvedValue(undefined)
    addJobMock.mockReset()
    updateJobMock.mockReset()
    useUIMediaFolderStore.setState({
      folders: [],
      selectedFolder: "",
      selectedFolders: [],
    })
  })

  it("imports media library via Core and updates folder store", async () => {
    const folderB = "/media/library/library-folder-B"
    const libraryPath = "/media/library"
    importLibraryViaCoreMock.mockResolvedValue("core-job-1")
    pollImportLibraryJobMock.mockResolvedValue({
      kind: "import-library",
      id: "core-job-1",
      libraryPath,
      type: "tvshow",
      status: "succeeded",
      progress: 100,
      folderPaths: [folderB],
      importedCount: 1,
      totalCount: 1,
      createdAt: 0,
      updatedAt: 0,
    })
    buildUiFoldersFromShowFolderMock.mockResolvedValue([
      { path: folderB, status: "ok", type: "tvshow-folder" },
    ])

    renderHandler()

    document.dispatchEvent(
      new CustomEvent(UI_MediaLibraryImportedEvent, {
        detail: {
          libraryPathInPlatformFormat: libraryPath,
          type: "tvshow",
          traceId: "test-trace",
        } satisfies OnMediaLibraryImportedEventData,
      }),
    )

    await vi.waitFor(() => {
      expect(importLibraryViaCoreMock).toHaveBeenCalledWith({
        path: libraryPath,
        type: "tvshow",
      })
    })

    expect(persistHarmonyOSFileAccessMock).toHaveBeenCalledWith([libraryPath])
    expect(pollImportLibraryJobMock).toHaveBeenCalled()
    expect(refreshUserConfigMock).toHaveBeenCalled()
    expect(buildUiFoldersFromShowFolderMock).toHaveBeenCalledWith([folderB])

    const folders = useUIMediaFolderStore.getState().folders
    expect(folders.map((f) => f.path)).toContain(folderB)
    expect(updateJobMock).toHaveBeenCalledWith("job-1", { status: "succeeded", progress: 100 })
  })

  it("marks background job failed when Core import-library fails", async () => {
    const libraryPath = "/media/library"
    importLibraryViaCoreMock.mockResolvedValue("core-job-1")
    pollImportLibraryJobMock.mockResolvedValue({
      kind: "import-library",
      id: "core-job-1",
      libraryPath,
      type: "movie",
      status: "failed",
      progress: 0,
      folderPaths: [],
      importedCount: 0,
      totalCount: 1,
      error: "Library path not found",
      createdAt: 0,
      updatedAt: 0,
    })

    renderHandler()

    document.dispatchEvent(
      new CustomEvent(UI_MediaLibraryImportedEvent, {
        detail: {
          libraryPathInPlatformFormat: libraryPath,
          type: "movie",
        } satisfies OnMediaLibraryImportedEventData,
      }),
    )

    await vi.waitFor(() => {
      expect(updateJobMock).toHaveBeenCalledWith("job-1", { status: "failed" })
    })
  })
})
