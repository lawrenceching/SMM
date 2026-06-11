import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FILE_ACCESS_PERSIST_CHANNEL } from "./channels"
import { registerFileAccessPersistIpcHandlers } from "./fileAccessPersistIpc"
import { createFileAccessPersistPreloadApi } from "./preload/fileAccessPersistApi"

const ohosPreloadPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../ohos/preload.js",
)

vi.mock("electron", () => ({
  systemPreferences: {
    fileAccessPersist: vi.fn(),
    callArkTSFunction: vi.fn(),
  },
}))

describe("registerFileAccessPersistIpcHandlers", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("registers the file access persist IPC channel", () => {
    const channels: string[] = []
    const ipcMain = {
      handle: (channel: string, _handler: unknown) => {
        channels.push(channel)
      },
    }

    registerFileAccessPersistIpcHandlers(ipcMain as never)

    expect(channels).toEqual([FILE_ACCESS_PERSIST_CHANNEL])
  })

  it("no-ops on non-OHOS platforms", async () => {
    const originalPlatform = process.platform
    Object.defineProperty(process, "platform", { value: "win32" })

    let handler: ((...args: unknown[]) => Promise<unknown>) | undefined
    const ipcMain = {
      handle: (_channel: string, fn: (...args: unknown[]) => Promise<unknown>) => {
        handler = fn
      },
    }

    registerFileAccessPersistIpcHandlers(ipcMain as never)
    const result = await handler!(null, { paths: ["file://docs/storage/folder"] })

    expect(result).toEqual({ ok: true, skipped: true })

    Object.defineProperty(process, "platform", { value: originalPlatform })
  })
})

describe("createFileAccessPersistPreloadApi", () => {
  it("invokes the file access persist IPC channel", async () => {
    const invoke = vi.fn(async () => ({ ok: true }))
    const api = createFileAccessPersistPreloadApi({ invoke } as never)

    await expect(api.persist(["file://docs/storage/folder"])).resolves.toEqual({
      ok: true,
    })

    expect(invoke).toHaveBeenCalledWith(FILE_ACCESS_PERSIST_CHANNEL, {
      paths: ["file://docs/storage/folder"],
    })
  })
})

describe("ohos preload template", () => {
  it("uses the same file access persist channel as the main-process handler", () => {
    const source = readFileSync(ohosPreloadPath, "utf8")
    expect(source).toContain(FILE_ACCESS_PERSIST_CHANNEL)
    expect(source).toContain("fileAccess")
  })
})
