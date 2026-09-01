import { describe, expect, it } from "vitest"
import { folderMatchesSearchQuery } from "./sidebarFolderSearch"

describe("folderMatchesSearchQuery", () => {
  const folder = {
    mediaName: "Breaking Bad",
    path: "/media/tvshows/Breaking Bad",
  }

  it("matches all folders when query is empty", () => {
    expect(folderMatchesSearchQuery(folder, "")).toBe(true)
    expect(folderMatchesSearchQuery(folder, "   ")).toBe(true)
  })

  it("matches media name", () => {
    expect(folderMatchesSearchQuery(folder, "break")).toBe(true)
    expect(folderMatchesSearchQuery(folder, "xyz")).toBe(false)
  })

  it("matches path and basename", () => {
    expect(folderMatchesSearchQuery(folder, "tvshows")).toBe(true)
    expect(folderMatchesSearchQuery({ mediaName: "X", path: "/a/MyFolder" }, "myfolder")).toBe(
      true,
    )
  })
})
