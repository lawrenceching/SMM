import { describe, it, expect, vi, beforeEach } from "vitest"
import { createElement } from "react"
import { render } from "@testing-library/react"
import type { ListFilesResponseBody } from "@core/types"
import { Path } from "@core/path"

const { listFilesMock } = vi.hoisted(() => ({
  listFilesMock: vi.fn(),
}))

const { persistHarmonyOSFileAccessMock } = vi.hoisted(() => ({
  persistHarmonyOSFileAccessMock: vi.fn(),
}))

const { initializeImportedMediaFolderMock } = vi.hoisted(() => ({
  initializeImportedMediaFolderMock: vi.fn().mockResolvedValue(undefined),
}))

const { saveUserConfigMock } = vi.hoisted(() => ({
  saveUserConfigMock: vi.fn().mockResolvedValue(undefined),
}))

const { addJobMock, updateJobMock } = vi.hoisted(() => ({
  addJobMock: vi.fn(() => "job-1"),
  updateJobMock: vi.fn(),
}))

const { sortPathsBySidebarDisplayOrderMock } = vi.hoisted(() => ({
  sortPathsBySidebarDisplayOrderMock: vi.fn((paths: string[]) => [...paths]),
}))

vi.mock("@/api/listFiles", () => ({
  listFiles: listFilesMock,
}))

vi.mock("@/lib/persistHarmonyOSFileAccess", () => ({
  persistHarmonyOSFileAccess: persistHarmonyOSFileAccessMock,
}))

vi.mock("@/hooks/initialization/useInitializeImportedMediaFolder", () => ({
  useInitializeImportedMediaFolder: () => ({
    initializeImportedMediaFolder: initializeImportedMediaFolderMock,
  }),
}))

vi.mock("@/hooks/userConfig", () => ({
  useConfig: () => ({
    userConfig: {
      folders: ["/media/existing-folder-A"],
    },
    appConfig: {},
    isLoading: false,
    isUserConfigLoaded: true,
  }),
  useSaveUserConfigMutation: () => ({
    mutateAsync: saveUserConfigMock,
  }),
}))

vi.mock("@/hooks/useJobManager", () => ({
  useJobManager: () => ({
    addJob: addJobMock,
    updateJob: updateJobMock,
  }),
}))

vi.mock("@/stores/sidebarStore", () => ({
  sortPathsBySidebarDisplayOrder: sortPathsBySidebarDisplayOrderMock,
}))

import {
  _dedupFolders,
  _listFolders,
  listLibraryFoldersWithAccess,
  MediaLibraryImportedEventHandler,
} from "./MediaLibraryImportedEventHandler"
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore"
import { UI_MediaLibraryImportedEvent, type OnMediaLibraryImportedEventData } from "@/types/eventTypes"

describe("_listFolders", () => {
  beforeEach(() => {
    listFilesMock.mockReset()
    persistHarmonyOSFileAccessMock.mockReset()
  })

  it("calls listFiles with only folders, no hidden files, and the given path", async () => {
    const libraryPath = "/media/library"
    listFilesMock.mockResolvedValue({
      data: { path: libraryPath, items: [], size: 0 },
    } satisfies ListFilesResponseBody)

    await _listFolders(libraryPath)

    expect(listFilesMock).toHaveBeenCalledTimes(1)
    expect(listFilesMock).toHaveBeenCalledWith({
      path: libraryPath,
      onlyFolders: true,
      includeHiddenFiles: false,
    })
  })

  it("returns folder paths from response items", async () => {
    listFilesMock.mockResolvedValue({
      data: {
        path: "/media/library",
        size: 2,
        items: [
          { path: "/media/library/a", size: 0, mtime: 0, isDirectory: true },
          { path: "/media/library/b", size: 0, mtime: 0, isDirectory: true },
        ],
      },
    } satisfies ListFilesResponseBody)

    await expect(_listFolders("/media/library")).resolves.toEqual(["/media/library/a", "/media/library/b"])
  })

  it("returns empty array when response has no data", async () => {
    listFilesMock.mockResolvedValue({} satisfies ListFilesResponseBody)

    await expect(_listFolders("/media/library")).resolves.toEqual([])
  })

  it("returns empty array when data.items is empty", async () => {
    listFilesMock.mockResolvedValue({
      data: { path: "/media/library", items: [], size: 0 },
    } satisfies ListFilesResponseBody)

    await expect(_listFolders("/media/library")).resolves.toEqual([])
  })
})

describe("listLibraryFoldersWithAccess", () => {
  beforeEach(() => {
    listFilesMock.mockReset()
    persistHarmonyOSFileAccessMock.mockReset()
    persistHarmonyOSFileAccessMock.mockResolvedValue(undefined)
  })

  it("persists library access before listing folders", async () => {
    const libraryPath = "file://docs/storage/media-library"
    listFilesMock.mockResolvedValue({
      data: {
        path: libraryPath,
        size: 1,
        items: [{ path: `${libraryPath}/show-a`, size: 0, mtime: 0, isDirectory: true }],
      },
    } satisfies ListFilesResponseBody)

    const callOrder: string[] = []
    persistHarmonyOSFileAccessMock.mockImplementation(async () => {
      callOrder.push("persist")
    })
    listFilesMock.mockImplementation(async () => {
      callOrder.push("listFiles")
      return {
        data: {
          path: libraryPath,
          size: 1,
          items: [{ path: `${libraryPath}/show-a`, size: 0, mtime: 0, isDirectory: true }],
        },
      } satisfies ListFilesResponseBody
    })

    await listLibraryFoldersWithAccess(libraryPath)

    expect(persistHarmonyOSFileAccessMock).toHaveBeenCalledWith([libraryPath])
    expect(listFilesMock).toHaveBeenCalledTimes(1)
    expect(callOrder).toEqual(["persist", "listFiles"])
  })

  it("does not list folders when persist fails", async () => {
    persistHarmonyOSFileAccessMock.mockRejectedValue(
      new Error("无法持久化文件夹访问权限"),
    )

    await expect(
      listLibraryFoldersWithAccess("file://docs/storage/media-library"),
    ).rejects.toThrow("无法持久化文件夹访问权限")

    expect(listFilesMock).not.toHaveBeenCalled()
  })
})

describe("_dedupFolders", () => {
  it("returns all new folders when there is no existing metadata", () => {
    const incoming = ["/media/show-a", "/media/show-b"]
    expect(_dedupFolders(incoming, [])).toEqual(incoming)
  })

  it("returns empty when every new folder is already imported", () => {
    expect(_dedupFolders(["/media/show-a", "/media/show-b"], ["/media/show-a", "/media/show-b"])).toEqual([])
  })

  it("keeps only folders that are not already imported", () => {
    expect(_dedupFolders(["/media/show-a", "/media/show-b"], ["/media/show-a"])).toEqual(["/media/show-b"])
  })

  it("matches paths after normalizing with Path.posix so platform paths dedupe against existing folder paths", () => {
    const winPath = "D:\\library\\TV\\MyShow"
    const incoming = [winPath, "D:\\library\\TV\\OtherShow"]
    const result = _dedupFolders(incoming, [winPath])
    expect(result).toEqual(["D:\\library\\TV\\OtherShow"])
    expect(Path.posix(result[0]!)).toBe(Path.posix("D:\\library\\TV\\OtherShow"))
  })

  it("ignores entries without a usable folder path", () => {
    expect(_dedupFolders(["/media/keep", "/media/new"], [""])).toEqual(["/media/keep", "/media/new"])
  })
})

describe("MediaLibraryImportedEventHandler integration", () => {
  beforeEach(() => {
    listFilesMock.mockReset()
    persistHarmonyOSFileAccessMock.mockReset()
    initializeImportedMediaFolderMock.mockReset()
    saveUserConfigMock.mockReset()
    addJobMock.mockReset()
    updateJobMock.mockReset()
    sortPathsBySidebarDisplayOrderMock.mockReset()
    sortPathsBySidebarDisplayOrderMock.mockImplementation((paths: string[]) => [...paths])
    persistHarmonyOSFileAccessMock.mockResolvedValue(undefined)
    initializeImportedMediaFolderMock.mockResolvedValue(undefined)
    saveUserConfigMock.mockResolvedValue(undefined)
    useUIMediaFolderStore.setState({
      folders: [],
      selectedFolder: "",
      selectedFolders: [],
    })
  })

  it("preserves already-imported folders when a media library is imported (regression)", async () => {
    // Pre-populate the store with a previously-imported folder A.
    const folderA = "/media/existing-folder-A"
    useUIMediaFolderStore.setState({
      folders: [{ path: folderA, status: "ok" }],
      selectedFolder: "",
      selectedFolders: [],
    })

    // Mock the library listing to return folder B (a new folder inside the library).
    const folderB = "/media/library/library-folder-B"
    const libraryPath = "/media/library"
    listFilesMock.mockResolvedValue({
      data: {
        path: libraryPath,
        size: 1,
        items: [{ path: folderB, size: 0, mtime: 0, isDirectory: true }],
      },
    } satisfies ListFilesResponseBody)

    render(createElement(MediaLibraryImportedEventHandler))

    const eventData: OnMediaLibraryImportedEventData = {
      libraryPathInPlatformFormat: libraryPath,
      type: "tvshow",
      traceId: "test-trace",
    }
    document.dispatchEvent(
      new CustomEvent(UI_MediaLibraryImportedEvent, { detail: eventData }),
    )

    // Wait for the async handler to finish (it must call initializeImportedMediaFolder for B).
    await vi.waitFor(() => {
      expect(initializeImportedMediaFolderMock).toHaveBeenCalled()
    })

    const folders = useUIMediaFolderStore.getState().folders
    const paths = folders.map((f) => f.path)

    // The bug was: importing a media library wiped out folder A.
    // After fix: both A and B must be present in the store.
    expect(paths).toContain(folderA)
    expect(paths).toContain(folderB)
    expect(folders).toHaveLength(2)

    // userConfig must also be saved with both folders appended.
    expect(saveUserConfigMock).toHaveBeenCalledTimes(1)
    const savedConfig = saveUserConfigMock.mock.calls[0]![0].config
    expect(savedConfig.folders).toEqual([folderA, folderB])
  })

  it("does not duplicate folders already present in the store", async () => {
    // Folder A is already in both the store AND userConfig.
    const folderA = "/media/existing-folder-A"
    useUIMediaFolderStore.setState({
      folders: [{ path: folderA, status: "ok" }],
      selectedFolder: "",
      selectedFolders: [],
    })

    // The library contains folder A (already imported) and folder B (new).
    const folderB = "/media/library/library-folder-B"
    const libraryPath = "/media/library"
    listFilesMock.mockResolvedValue({
      data: {
        path: libraryPath,
        size: 2,
        items: [
          { path: folderA, size: 0, mtime: 0, isDirectory: true },
          { path: folderB, size: 0, mtime: 0, isDirectory: true },
        ],
      },
    } satisfies ListFilesResponseBody)

    render(createElement(MediaLibraryImportedEventHandler))

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
      expect(initializeImportedMediaFolderMock).toHaveBeenCalled()
    })

    const folders = useUIMediaFolderStore.getState().folders
    const paths = folders.map((f) => f.path)
    // A must remain, B must be added, and there must be exactly one of each.
    expect(paths.filter((p) => p === folderA)).toHaveLength(1)
    expect(paths.filter((p) => p === folderB)).toHaveLength(1)
    expect(folders).toHaveLength(2)
  })
})
