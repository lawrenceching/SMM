import { afterEach, describe, expect, it, vi } from "vitest"
import { EXECUTE_CHANNEL, OPEN_FILE_CHANNEL, OPEN_IN_FILE_MANAGER_CHANNEL } from "./channels"
import { registerExecuteChannelIpcHandlers, routeExecuteChannel } from "./executeChannelIpc"
import { openFileWithShell } from "./openFileTask"
import { openInFileManager } from "./openInFileManagerTask"
import { createExecuteChannelPreloadApi } from "./preload/executeChannelApi"

vi.mock("electron", () => ({
  shell: {
    showItemInFolder: vi.fn(async () => ""),
    openPath: vi.fn(async () => ""),
  },
  systemPreferences: {
    callArkTSFunction: vi.fn(),
  },
}))

describe("openFileWithShell", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("returns success when shell.openPath returns empty string", async () => {
    const { shell } = await import("electron")
    vi.mocked(shell.openPath).mockResolvedValue("")

    await expect(openFileWithShell("/tmp/fanart.jpg")).resolves.toEqual({ success: true })
    expect(shell.openPath).toHaveBeenCalledWith("/tmp/fanart.jpg")
  })

  it("returns error when path is empty", async () => {
    const { shell } = await import("electron")

    const result = await openFileWithShell("")

    expect(result).toEqual({
      success: false,
      error: "Path is required and must be a string",
    })
    expect(shell.openPath).not.toHaveBeenCalled()
  })

  it("returns error message when shell.openPath fails", async () => {
    const { shell } = await import("electron")
    vi.mocked(shell.openPath).mockResolvedValue("Failed to open path")

    const result = await openFileWithShell("/tmp/missing.jpg")

    expect(result).toEqual({ success: false, error: "Failed to open path" })
  })
})

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

  it("routes open-file to openFileWithShell task", async () => {
    const { shell } = await import("electron")
    vi.mocked(shell.openPath).mockResolvedValue("")

    const response = await routeExecuteChannel({
      name: OPEN_FILE_CHANNEL,
      data: "/tmp/fanart.jpg",
    })

    expect(response).toEqual({
      name: OPEN_FILE_CHANNEL,
      data: { success: true },
    })
    expect(shell.openPath).toHaveBeenCalledWith("/tmp/fanart.jpg")
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
