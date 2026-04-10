import { describe, it, expect, vi, beforeEach } from "vitest"
import type { ListFilesResponseBody } from "@core/types"
import { createMediaMetadata } from "@core/mediaMetadata"
import { Path } from "@core/path"
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"

const { listFilesMock } = vi.hoisted(() => ({
  listFilesMock: vi.fn(),
}))

vi.mock("@/api/listFiles", () => ({
  listFiles: listFilesMock,
}))

import { _dedupFolders, _listFolders } from "./MediaLibraryImportedEventHandler"

function mockUIMetadata(
  folderPathInPlatformFormat: string,
  type: "music-folder" | "tvshow-folder" | "movie-folder" = "tvshow-folder",
): UIMediaMetadata {
  return {
    ...createMediaMetadata(folderPathInPlatformFormat, type),
    status: "idle",
  }
}

describe("_listFolders", () => {
  beforeEach(() => {
    listFilesMock.mockReset()
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

describe("_dedupFolders", () => {
  it("returns all new folders when there is no existing metadata", () => {
    const incoming = ["/media/show-a", "/media/show-b"]
    expect(_dedupFolders(incoming, [])).toEqual(incoming)
  })

  it("returns empty when every new folder is already imported", () => {
    const a = mockUIMetadata("/media/show-a")
    const b = mockUIMetadata("/media/show-b")
    expect(_dedupFolders(["/media/show-a", "/media/show-b"], [a, b])).toEqual([])
  })

  it("keeps only folders that are not already imported", () => {
    const existing = mockUIMetadata("/media/show-a")
    expect(_dedupFolders(["/media/show-a", "/media/show-b"], [existing])).toEqual(["/media/show-b"])
  })

  it("matches paths after normalizing with Path.posix so platform paths dedupe against stored metadata", () => {
    const winPath = "D:\\library\\TV\\MyShow"
    const existing = mockUIMetadata(winPath)
    const incoming = [winPath, "D:\\library\\TV\\OtherShow"]
    const result = _dedupFolders(incoming, [existing])
    expect(result).toEqual(["D:\\library\\TV\\OtherShow"])
    expect(Path.posix(result[0]!)).toBe(Path.posix("D:\\library\\TV\\OtherShow"))
  })

  it("ignores metadata entries without a usable mediaFolderPath", () => {
    const metadatas: UIMediaMetadata[] = [
      { type: "tvshow-folder", status: "idle" } as UIMediaMetadata,
      { ...mockUIMetadata("/media/keep"), mediaFolderPath: "", status: "idle" },
    ]
    expect(_dedupFolders(["/media/keep", "/media/new"], metadatas)).toEqual(["/media/keep", "/media/new"])
  })
})
