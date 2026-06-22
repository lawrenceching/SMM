import { describe, expect, it, vi } from "vitest"
import { createGetPathForFilePreloadApi } from "./getPathForFileApi"

describe("createGetPathForFilePreloadApi", () => {
  it("returns path from webUtils.getPathForFile", () => {
    const file = new File([], "folder")
    const api = createGetPathForFilePreloadApi({
      getPathForFile: vi.fn(() => "file://docs/storage/Media/TV Show"),
    })

    expect(api.getPathForFile(file)).toBe("file://docs/storage/Media/TV Show")
  })

  it("returns null when webUtils returns empty string", () => {
    const file = new File([], "folder")
    const api = createGetPathForFilePreloadApi({
      getPathForFile: vi.fn(() => ""),
    })

    expect(api.getPathForFile(file)).toBeNull()
  })

  it("returns null when webUtils throws", () => {
    const file = new File([], "folder")
    const api = createGetPathForFilePreloadApi({
      getPathForFile: vi.fn(() => {
        throw new Error("unsupported")
      }),
    })

    expect(api.getPathForFile(file)).toBeNull()
  })
})
