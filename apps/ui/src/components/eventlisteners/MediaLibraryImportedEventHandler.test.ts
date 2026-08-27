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

const { getJobViaCoreMock } = vi.hoisted(() => ({
  getJobViaCoreMock: vi.fn(),
}))

const {
  pollImportLibraryJobMock,
  buildUiFoldersFromShowFolderMock,
  waitForLibraryFoldersRegisteredMock,
} = vi.hoisted(() => ({
  pollImportLibraryJobMock: vi.fn(),
  buildUiFoldersFromShowFolderMock: vi.fn(),
  waitForLibraryFoldersRegisteredMock: vi.fn(),
}))

const { refreshUserConfigMock } = vi.hoisted(() => ({
  refreshUserConfigMock: vi.fn().mockResolvedValue(undefined),
}))

const { invalidateFoldersQueryIfV3Mock } = vi.hoisted(() => ({
  invalidateFoldersQueryIfV3Mock: vi.fn(),
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

vi.mock("@/api/getJob", () => ({
  getJobViaCore: getJobViaCoreMock,
}))

vi.mock("@/lib/importLibraryV3", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/importLibraryV3")>()
  return {
    ...actual,
    pollImportLibraryJob: pollImportLibraryJobMock,
    buildUiFoldersFromShowFolder: buildUiFoldersFromShowFolderMock,
    waitForLibraryFoldersRegistered: waitForLibraryFoldersRegisteredMock,
  }
})

vi.mock("@/hooks/userConfig", () => ({
  useRefreshUserConfig: () => refreshUserConfigMock,
}))

vi.mock("@/hooks/folders", () => ({
  invalidateFoldersQueryIfV3: invalidateFoldersQueryIfV3Mock,
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

function makeImportLibraryJob(
  overrides: Partial<{
    id: string
    libraryPath: string
    type: "tvshow" | "music" | "movie"
    status: "pending" | "running" | "succeeded" | "failed"
    progress: number
    tasks: Array<{ id: string; path: string; status: "pending" | "running" | "succeeded" | "failed" }>
    error?: string
  }> = {},
) {
  return {
    kind: "import-library" as const,
    id: "core-job-1",
    libraryPath: "/media/library",
    type: "tvshow" as const,
    status: "succeeded" as const,
    progress: 100,
    tasks: [],
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

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
    return queryClient
  }

  beforeEach(() => {
    importLibraryViaCoreMock.mockReset()
    getJobViaCoreMock.mockReset()
    pollImportLibraryJobMock.mockReset()
    buildUiFoldersFromShowFolderMock.mockReset()
    waitForLibraryFoldersRegisteredMock.mockReset()
    refreshUserConfigMock.mockReset()
    refreshUserConfigMock.mockResolvedValue(undefined)
    invalidateFoldersQueryIfV3Mock.mockReset()
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

  it("refreshes sidebar after registration and before polling the import job", async () => {
    const folderB = "/media/library/library-folder-B"
    const libraryPath = "/media/library"
    importLibraryViaCoreMock.mockResolvedValue("core-job-1")
    waitForLibraryFoldersRegisteredMock.mockResolvedValue([folderB])
    getJobViaCoreMock.mockResolvedValue(
      makeImportLibraryJob({
        libraryPath,
        tasks: [{ id: "t0", path: folderB, status: "pending" }],
        status: "running",
        progress: 0,
      }),
    )
    pollImportLibraryJobMock.mockResolvedValue(
      makeImportLibraryJob({
        libraryPath,
        tasks: [{ id: "t0", path: folderB, status: "succeeded" }],
      }),
    )
    buildUiFoldersFromShowFolderMock.mockResolvedValue([
      { path: folderB, status: "ok", type: "tvshow-folder" },
    ])

    const queryClient = renderHandler()

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
        traceId: "test-trace",
      })
    })

    expect(persistHarmonyOSFileAccessMock).toHaveBeenCalledWith([libraryPath])
    expect(waitForLibraryFoldersRegisteredMock).toHaveBeenCalledWith("core-job-1", { traceId: "test-trace" })
    expect(refreshUserConfigMock).toHaveBeenCalled()
    expect(invalidateFoldersQueryIfV3Mock).toHaveBeenCalledWith(queryClient)
    expect(getJobViaCoreMock).toHaveBeenCalledWith("core-job-1")

    const refreshOrder = refreshUserConfigMock.mock.invocationCallOrder[0]!
    const pollOrder = pollImportLibraryJobMock.mock.invocationCallOrder[0]!
    expect(refreshOrder).toBeLessThan(pollOrder)

    expect(pollImportLibraryJobMock).toHaveBeenCalled()
    expect(buildUiFoldersFromShowFolderMock).toHaveBeenCalledWith([folderB], { traceId: "test-trace" })

    const folders = useUIMediaFolderStore.getState().folders
    expect(folders.map((f) => f.path)).toContain(folderB)
    expect(updateJobMock).toHaveBeenCalledWith("job-1", { status: "succeeded", progress: 100 })
  })

  it("syncs per-folder status from import-library job tasks", async () => {
    const folderA = "/media/library/A"
    const libraryPath = "/media/library"
    importLibraryViaCoreMock.mockResolvedValue("core-job-1")
    waitForLibraryFoldersRegisteredMock.mockResolvedValue([folderA])
    getJobViaCoreMock.mockResolvedValue(
      makeImportLibraryJob({
        libraryPath,
        type: "music",
        tasks: [{ id: "t0", path: folderA, status: "running" }],
        status: "running",
        progress: 0,
      }),
    )

    let resolvePoll!: (value: unknown) => void
    const pollDeferred = new Promise((resolve) => {
      resolvePoll = resolve
    })
    pollImportLibraryJobMock.mockImplementation(async () => {
      await pollDeferred
      return makeImportLibraryJob({
        libraryPath,
        type: "music",
        tasks: [{ id: "t0", path: folderA, status: "succeeded" }],
      })
    })
    buildUiFoldersFromShowFolderMock.mockResolvedValue([
      { path: folderA, status: "ok", type: "music-folder" },
    ])

    renderHandler()

    document.dispatchEvent(
      new CustomEvent(UI_MediaLibraryImportedEvent, {
        detail: {
          libraryPathInPlatformFormat: libraryPath,
          type: "music",
        } satisfies OnMediaLibraryImportedEventData,
      }),
    )

    await vi.waitFor(() => {
      const folder = useUIMediaFolderStore.getState().folders.find((f) => f.path === folderA)
      expect(folder?.status).toBe("initializing")
    })

    resolvePoll(undefined)
    await vi.waitFor(() => {
      expect(updateJobMock).toHaveBeenCalledWith("job-1", { status: "succeeded", progress: 100 })
    })
  })

  it("marks background job failed when Core import-library fails", async () => {
    const libraryPath = "/media/library"
    importLibraryViaCoreMock.mockResolvedValue("core-job-1")
    waitForLibraryFoldersRegisteredMock.mockResolvedValue([])
    getJobViaCoreMock.mockResolvedValue(
      makeImportLibraryJob({
        libraryPath,
        type: "movie",
        status: "failed",
        progress: 0,
        error: "Library path not found",
      }),
    )
    pollImportLibraryJobMock.mockResolvedValue(
      makeImportLibraryJob({
        libraryPath,
        type: "movie",
        status: "failed",
        progress: 0,
        error: "Library path not found",
      }),
    )

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
