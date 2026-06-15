import { describe, expect, it } from "vitest"
import type { MediaMetadata } from "@core/types"
import { findMediaMetadataForPath } from "./mediaMetadataLookup"

describe("findMediaMetadataForPath", () => {
  const metadatas: MediaMetadata[] = [
    {
      mediaFolderPath:
        "/C/Users/lawrence/Downloads/media/[测试用字幕组] キルミーベイベー",
      type: "tvshow-folder",
      files: ["fanart.jpg", "poster.jpg"],
    },
  ]

  it("matches Windows-format input against POSIX mediaFolderPath", () => {
    const result = findMediaMetadataForPath(
      metadatas,
      "C:\\Users\\lawrence\\Downloads\\media\\[测试用字幕组] キルミーベイベー",
    )

    expect(result).toBe(metadatas[0])
    expect(result?.files).toEqual(["fanart.jpg", "poster.jpg"])
  })

  it("matches POSIX-format input", () => {
    const result = findMediaMetadataForPath(
      metadatas,
      "/C/Users/lawrence/Downloads/media/[测试用字幕组] キルミーベイベー",
    )

    expect(result).toBe(metadatas[0])
  })

  it("returns undefined when folder is not managed by SMM", () => {
    const result = findMediaMetadataForPath(
      metadatas,
      "C:\\Users\\lawrence\\Downloads\\media\\other-show",
    )

    expect(result).toBeUndefined()
  })
})
