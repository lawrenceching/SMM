import { describe, expect, it } from "vitest"
import { isPathInSelection, nextFolderSelection } from "./sidebarFolderSelection"

describe("nextFolderSelection", () => {
  it("replaces selection on single click", () => {
    expect(nextFolderSelection(["/a", "/b"], "/c", false)).toEqual({
      selectedPaths: ["/c"],
      primaryPath: "/c",
    })
  })

  it("toggles path on multi click", () => {
    expect(nextFolderSelection(["/a"], "/b", true)).toEqual({
      selectedPaths: ["/a", "/b"],
      primaryPath: "/b",
    })
    expect(nextFolderSelection(["/a", "/b"], "/a", true)).toEqual({
      selectedPaths: ["/b"],
      primaryPath: "/a",
    })
  })
})

describe("isPathInSelection", () => {
  it("matches posix-equivalent paths", () => {
    expect(isPathInSelection("/media/a", ["/media/a", "/media/b"])).toBe(true)
    expect(isPathInSelection("/media/c", ["/media/a"])).toBe(false)
  })
})
