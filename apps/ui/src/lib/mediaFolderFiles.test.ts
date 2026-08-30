import { describe, expect, it } from "vitest"
import type { MediaMetadata } from "@core/types"
import { withLiveFolderFiles } from "./mediaFolderFiles"

const persisted: MediaMetadata = {
  mediaFolderPath: "/media/show",
  type: "tvshow-folder",
  mediaFiles: [],
}

describe("withLiveFolderFiles", () => {
  it("keeps live files from previous cache when persisted metadata omits them", () => {
    expect(
      withLiveFolderFiles(persisted, {
        ...persisted,
        files: ["/media/show/S01E01.mkv"],
      }),
    ).toEqual({
      ...persisted,
      files: ["/media/show/S01E01.mkv"],
    })
  })

  it("keeps live files from the incoming save payload when cache is empty", () => {
    expect(
      withLiveFolderFiles(persisted, undefined, {
        ...persisted,
        files: ["/media/show/S01E01.mkv"],
      }),
    ).toEqual({
      ...persisted,
      files: ["/media/show/S01E01.mkv"],
    })
  })

  it("prefers previous cache files over incoming files", () => {
    expect(
      withLiveFolderFiles(
        persisted,
        { ...persisted, files: ["/media/show/cached.mkv"] },
        { ...persisted, files: ["/media/show/incoming.mkv"] },
      ),
    ).toEqual({
      ...persisted,
      files: ["/media/show/cached.mkv"],
    })
  })
})
