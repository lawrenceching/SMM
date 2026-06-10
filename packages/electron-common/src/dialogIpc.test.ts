import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it, vi } from "vitest"
import {
  DIALOG_SHOW_OPEN_CHANNEL,
  DIALOG_SHOW_SAVE_CHANNEL,
} from "../src/channels"
import { registerDialogIpcHandlers } from "../src/dialogIpc"
import { createDialogPreloadApi } from "../src/preload/dialogApi"

const ohosPreloadPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../ohos/preload.js",
)

describe("registerDialogIpcHandlers", () => {
  it("registers open and save dialog IPC channels", () => {
    const channels: string[] = []
    const ipcMain = {
      handle: (channel: string, _handler: unknown) => {
        channels.push(channel)
      },
    }

    registerDialogIpcHandlers(ipcMain as never)

    expect(channels).toEqual([DIALOG_SHOW_OPEN_CHANNEL, DIALOG_SHOW_SAVE_CHANNEL])
  })
})

describe("createDialogPreloadApi", () => {
  it("invokes IPC channels for open and save dialogs", async () => {
    const invoke = vi.fn(async (channel: string) => {
      if (channel === DIALOG_SHOW_OPEN_CHANNEL) {
        return { canceled: false, filePaths: ["/tmp/folder"] }
      }
      return { canceled: false, filePath: "/tmp/out.txt" }
    })

    const api = createDialogPreloadApi({ invoke } as never)

    await expect(
      api.showOpenDialog({ properties: ["openDirectory"] }),
    ).resolves.toEqual({ canceled: false, filePaths: ["/tmp/folder"] })
    await expect(api.showSaveDialog({ title: "Save" })).resolves.toEqual({
      canceled: false,
      filePath: "/tmp/out.txt",
    })

    expect(invoke).toHaveBeenCalledWith(DIALOG_SHOW_OPEN_CHANNEL, {
      properties: ["openDirectory"],
    })
    expect(invoke).toHaveBeenCalledWith(DIALOG_SHOW_SAVE_CHANNEL, { title: "Save" })
  })
})

describe("ohos preload template", () => {
  it("uses the same IPC channel names as the main-process handlers", () => {
    const source = readFileSync(ohosPreloadPath, "utf8")
    expect(source).toContain(DIALOG_SHOW_OPEN_CHANNEL)
    expect(source).toContain(DIALOG_SHOW_SAVE_CHANNEL)
  })
})
