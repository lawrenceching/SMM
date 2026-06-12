import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import {
  getAllowedRootItems,
  resetAllowedRootItemsCache,
  resolveRedirect,
  toFileUrl,
} from "./file-protocol-redirect"

describe("toFileUrl", () => {
  it("converts posix path to file URL", () => {
    expect(toFileUrl("/data/app/dist/assets/main.js")).toBe(
      "file:///data/app/dist/assets/main.js",
    )
  })

  it("converts Windows path to file URL", () => {
    expect(toFileUrl("C:/Users/app/dist/assets/main.js")).toBe(
      "file:///C:/Users/app/dist/assets/main.js",
    )
  })
})

describe("resolveRedirect", () => {
  let distDir: string

  afterEach(() => {
    resetAllowedRootItemsCache()
    if (distDir) {
      fs.rmSync(distDir, { recursive: true, force: true })
    }
  })

  it("returns null for non-file URLs", () => {
    expect(resolveRedirect("http://127.0.0.1/assets/main.js")).toBeNull()
  })

  it("returns null for Windows-style file paths", () => {
    expect(resolveRedirect("file:///C:/assets/main.js", distDir)).toBeNull()
  })

  it("returns null for empty relative path", () => {
    distDir = fs.mkdtempSync(path.join(os.tmpdir(), "ohos-dist-"))
    expect(resolveRedirect("file:///", distDir)).toBeNull()
  })

  it("redirects whitelisted dist assets to file URL", () => {
    distDir = fs.mkdtempSync(path.join(os.tmpdir(), "ohos-dist-"))
    fs.mkdirSync(path.join(distDir, "assets"), { recursive: true })
    getAllowedRootItems(distDir)

    const result = resolveRedirect("file:///assets/main.js", distDir)
    expect(result).toBe(toFileUrl(path.join(distDir, "assets/main.js")))
  })

  it("returns null when path traversal escapes dist", () => {
    distDir = fs.mkdtempSync(path.join(os.tmpdir(), "ohos-dist-"))
    expect(resolveRedirect("file:///../etc/passwd", distDir)).toBeNull()
  })
})
