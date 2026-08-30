import { describe, expect, it } from "vitest"
import { applyMetadataPatch } from "./setMetadataPatch"
import { MetadataValidationError } from "./metadataErrors"

describe("applyMetadataPatch", () => {
  const base = { mediaFolderPath: "/m/Show", type: "movie-folder" as const }

  it("merges allowed keys", () => {
    const next = applyMetadataPatch(base, {
      mediaFiles: [{ absolutePath: "/m/Show/a.mp4" }],
      movie: { id: 1, title: "A" } as never,
    })
    expect(next.mediaFiles?.[0]?.absolutePath).toBe("/m/Show/a.mp4")
    expect(next.type).toBe("movie-folder")
  })

  it("rejects unknown keys", () => {
    expect(() => applyMetadataPatch(base, { mediaFolderPath: "/x" })).toThrow(MetadataValidationError)
  })
})
