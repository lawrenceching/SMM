import { describe, expect, it } from "vitest"
import type { RenameFileExistenceProbe } from "./validateRenameFileExistence"
import {
  validateDestFilesNotExist,
  validateSourceFilesExist,
} from "./validateRenameFileExistence"
import { validateRenameOperations } from "./validateRenameOperations"

function probeFromSet(files: Set<string>): RenameFileExistenceProbe {
  return {
    isFile: async (path) => files.has(path),
  }
}

describe("validateSourceFilesExist / validateDestFilesNotExist", () => {
  it("flags missing sources", async () => {
    const probe = probeFromSet(new Set(["/m/a.mp4"]))
    const result = await validateSourceFilesExist(
      [
        { from: "/m/a.mp4", to: "/m/b.mp4" },
        { from: "/m/missing.mp4", to: "/m/c.mp4" },
      ],
      probe,
    )
    expect(result.isValid).toBe(false)
    expect(result.missingFiles).toEqual(["/m/missing.mp4"])
  })

  it("flags existing destinations", async () => {
    const probe = probeFromSet(new Set(["/m/a.mp4", "/m/b.mp4"]))
    const result = await validateDestFilesNotExist(
      [{ from: "/m/a.mp4", to: "/m/b.mp4" }],
      probe,
    )
    expect(result.isValid).toBe(false)
    expect(result.existingFiles).toEqual(["/m/b.mp4"])
  })
})

describe("validateRenameOperations", () => {
  const folder = "/m/Show"

  it("passes when paths are valid and FS state is free", async () => {
    const probe = probeFromSet(new Set([`${folder}/S01E01.mp4`, `${folder}/S01E01.srt`]))
    const result = await validateRenameOperations(
      [
        { from: `${folder}/S01E01.mp4`, to: `${folder}/S01E01_renamed.mp4` },
        { from: `${folder}/S01E01.srt`, to: `${folder}/S01E01_renamed.srt` },
      ],
      folder,
      probe,
    )
    expect(result.isValid).toBe(true)
    expect(result.validatedRenames).toHaveLength(2)
  })

  it("refuses the whole batch when dest already exists", async () => {
    const probe = probeFromSet(
      new Set([`${folder}/S01E01.mp4`, `${folder}/S01E01_renamed.mp4`]),
    )
    const result = await validateRenameOperations(
      [{ from: `${folder}/S01E01.mp4`, to: `${folder}/S01E01_renamed.mp4` }],
      folder,
      probe,
    )
    expect(result.isValid).toBe(false)
    expect(result.validatedRenames).toEqual([])
    expect(result.errors.some((e) => e.includes("already exists"))).toBe(true)
  })

  it("refuses the whole batch when a path is outside the folder", async () => {
    const probe = probeFromSet(new Set(["/other/a.mp4"]))
    const result = await validateRenameOperations(
      [{ from: "/other/a.mp4", to: `${folder}/b.mp4` }],
      folder,
      probe,
    )
    expect(result.isValid).toBe(false)
    expect(result.validatedRenames).toEqual([])
  })
})
