import { mkdtemp, open, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { Hono } from "hono"
import { checkFolderPathAvailable, handleIsFolderAvailable } from "./IsFolderAvailable"

describe("checkFolderPathAvailable", () => {
  let dir: string

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "smm-is-folder-available-"))
  })

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it("returns true for an existing directory", async () => {
    await expect(checkFolderPathAvailable(dir)).resolves.toBe(true)
  })

  it("returns false for a missing path", async () => {
    await expect(checkFolderPathAvailable(join(dir, "does-not-exist"))).resolves.toBe(false)
  })

  it("returns false when path is a file", async () => {
    const filePath = join(dir, "not-a-dir.txt")
    const fh = await open(filePath, "w")
    await fh.close()
    await expect(checkFolderPathAvailable(filePath)).resolves.toBe(false)
  })
})

describe("POST /api/isFolderAvailable", () => {
  let dir: string
  let app: Hono

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "smm-is-folder-available-http-"))
    app = new Hono()
    handleIsFolderAvailable(app)
  })

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it("returns available true for a directory", async () => {
    const res = await app.request("/api/isFolderAvailable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: dir }),
    })
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ available: true })
  })

  it("returns available false for missing path", async () => {
    const res = await app.request("/api/isFolderAvailable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: join(dir, "nope") }),
    })
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ available: false })
  })

  it("returns 400 when path is missing", async () => {
    const res = await app.request("/api/isFolderAvailable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it("returns 400 for invalid JSON", async () => {
    const res = await app.request("/api/isFolderAvailable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    })
    expect(res.status).toBe(400)
  })
})
