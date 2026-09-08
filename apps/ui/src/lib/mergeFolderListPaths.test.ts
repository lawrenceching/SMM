import { describe, expect, it } from "vitest"
import { mergeFolderListPaths } from "./mergeFolderListPaths"

describe("mergeFolderListPaths", () => {
  it("returns query paths when store is empty", () => {
    expect(mergeFolderListPaths(["/a", "/b"], [])).toEqual(["/a", "/b"])
  })

  it("includes store-only optimistic paths after query paths", () => {
    expect(mergeFolderListPaths(["/a"], ["/b"])).toEqual(["/a", "/b"])
  })

  it("dedupes by POSIX path and prefers the query path string", () => {
    expect(
      mergeFolderListPaths(
        ["/media/Show"],
        ["/media/Show", "/media/Other"],
      ),
    ).toEqual(["/media/Show", "/media/Other"])
  })

  it("handles undefined query data", () => {
    expect(mergeFolderListPaths(undefined, ["/a"])).toEqual(["/a"])
  })
})
