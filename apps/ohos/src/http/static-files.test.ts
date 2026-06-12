import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { isPathWithinRoot, resolveStaticPath } from "./static-files"

describe("resolveStaticPath", () => {
  let rootDir: string

  afterEach(() => {
    if (rootDir) {
      fs.rmSync(rootDir, { recursive: true, force: true })
    }
  })

  it("maps / to index.html", () => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "ohos-static-"))
    expect(resolveStaticPath(rootDir, "/")).toBe(path.join(rootDir, "index.html"))
  })

  it("resolves nested asset paths", () => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "ohos-static-"))
    expect(resolveStaticPath(rootDir, "/assets/main.js")).toBe(
      path.join(rootDir, "assets/main.js"),
    )
  })

  it("rejects path traversal outside root", () => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "ohos-static-"))
    expect(resolveStaticPath(rootDir, "/../etc/passwd")).toBeNull()
  })
})

describe("isPathWithinRoot", () => {
  let rootDir: string

  afterEach(() => {
    if (rootDir) {
      fs.rmSync(rootDir, { recursive: true, force: true })
    }
  })

  it("accepts root itself", () => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "ohos-static-"))
    expect(isPathWithinRoot(rootDir, rootDir)).toBe(true)
  })

  it("accepts paths under root", () => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "ohos-static-"))
    expect(isPathWithinRoot(rootDir, path.join(rootDir, "assets", "main.js"))).toBe(true)
  })

  it("rejects paths outside root", () => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "ohos-static-"))
    expect(isPathWithinRoot(rootDir, path.join(os.tmpdir(), "outside.txt"))).toBe(false)
  })
})
