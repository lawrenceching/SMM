import { afterEach, describe, expect, it, vi } from "vitest"
import { EXECUTE_CHANNEL, OPEN_IN_FILE_MANAGER_CHANNEL } from "./channels"
import { registerExecuteChannelIpcHandlers, routeExecuteChannel } from "./executeChannelIpc"
import { openInFileManager } from "./openInFileManagerTask"
import { createExecuteChannelPreloadApi } from "./preload/executeChannelApi"

vi.mock("electron", () => ({
  shell: {
    showItemInFolder: vi.fn(async () => ""),
  },
  systemPreferences: {
    callArkTSFunction: vi.fn(),
  },
}))

describe("openInFileManager", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("returns success when shell.showItemInFolder succeeds", async () => {
    const { shell } = await import("electron")
    vi.mocked(shell.showItemInFolder).mockResolvedValue("")

    await expect(openInFileManager("/tmp/folder")).resolves.toEqual({ success: true })
  })

  it("does not use native fallback on non-OHOS platforms", async () => {
    const { shell, systemPreferences } = await import("electron")
    const originalPlatform = process.platform
    Object.defineProperty(process, "platform", { value: "win32" })
    vi.mocked(shell.showItemInFolder).mockRejectedValue(new Error("shell failed"))

    const result = await openInFileManager("/tmp/folder")

    expect(result.success).toBe(false)
    expect(systemPreferences.callArkTSFunction).not.toHaveBeenCalled()

    Object.defineProperty(process, "platform", { value: originalPlatform })
  })

  it("uses EtsBridge fallback on HarmonyOS when shell fails", async () => {
    const { shell, systemPreferences } = await import("electron")
    const originalPlatform = process.platform
    Object.defineProperty(process, "platform", { value: "openharmony" })
    vi.mocked(shell.showItemInFolder).mockRejectedValue(new Error("shell failed"))
    vi.mocked(systemPreferences.callArkTSFunction).mockReturnValue(true)

    const result = await openInFileManager("file://docs/storage/folder")

    expect(result).toEqual({ success: true })
    expect(systemPreferences.callArkTSFunction).toHaveBeenCalledWith(
      "EtsBridge.OpenItemInFolder",
      "boolean",
      ["file://docs/storage/folder"],
    )

    Object.defineProperty(process, "platform", { value: originalPlatform })
  })
})

describe("routeExecuteChannel", () => {
  it("routes open-in-file-manager to openInFileManager task", async () => {
    const { shell } = await import("electron")
    vi.mocked(shell.showItemInFolder).mockResolvedValue("")

    const response = await routeExecuteChannel({
      name: OPEN_IN_FILE_MANAGER_CHANNEL,
      data: "/tmp/folder",
    })

    expect(response).toEqual({
      name: OPEN_IN_FILE_MANAGER_CHANNEL,
      data: { success: true },
    })
  })

  it("routes get-config when handler is provided", async () => {
    const response = await routeExecuteChannel(
      { name: "get-config", data: null },
      { getConfig: async () => ({ userConfigPath: "/data/user" }) },
    )

    expect(response).toEqual({
      name: "get-config",
      data: { userConfigPath: "/data/user" },
    })
  })
})

describe("registerExecuteChannelIpcHandlers", () => {
  it("registers ExecuteChannel IPC", () => {
    const channels: string[] = []
    const ipcMain = {
      handle: (channel: string, _handler: unknown) => {
        channels.push(channel)
      },
    }

    registerExecuteChannelIpcHandlers(ipcMain as never)

    expect(channels).toEqual([EXECUTE_CHANNEL])
  })
})

describe("createExecuteChannelPreloadApi", () => {
  it("invokes ExecuteChannel IPC", async () => {
    const invoke = vi.fn(async () => ({
      name: OPEN_IN_FILE_MANAGER_CHANNEL,
      data: { success: true },
    }))
    const api = createExecuteChannelPreloadApi({ invoke } as never)

    await expect(
      api.executeChannel({ name: OPEN_IN_FILE_MANAGER_CHANNEL, data: "/tmp/folder" }),
    ).resolves.toEqual({
      name: OPEN_IN_FILE_MANAGER_CHANNEL,
      data: { success: true },
    })

    expect(invoke).toHaveBeenCalledWith(EXECUTE_CHANNEL, {
      name: OPEN_IN_FILE_MANAGER_CHANNEL,
      data: "/tmp/folder",
    })
  })
})
