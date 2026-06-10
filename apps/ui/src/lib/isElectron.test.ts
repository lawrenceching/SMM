import { describe, expect, it, vi, afterEach } from "vitest"
import { isElectron } from "./isElectron"
import { openNativeFolderDialog, openNativeOpenDialog } from "./nativeFolderDialog"

describe("isElectron", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns false when window.electron is undefined", () => {
    vi.stubGlobal("window", {})
    expect(isElectron()).toBe(false)
  })

  it("returns true when window.electron exists", () => {
    vi.stubGlobal("window", { electron: { dialog: {} } })
    expect(isElectron()).toBe(true)
  })
})

describe("openNativeFolderDialog", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns null when not in Electron", async () => {
    vi.stubGlobal("window", {})
    await expect(openNativeFolderDialog()).resolves.toBeNull()
  })

  it("returns folder item when dialog succeeds", async () => {
    const showOpenDialog = vi.fn().mockResolvedValue({
      canceled: false,
      filePaths: ["/media/TV Show"],
    })
    vi.stubGlobal("window", { electron: { dialog: { showOpenDialog } } })

    await expect(openNativeFolderDialog({ title: "Pick folder" })).resolves.toEqual({
      name: "TV Show",
      path: "/media/TV Show",
      isDirectory: true,
    })

    expect(showOpenDialog).toHaveBeenCalledWith({
      properties: ["openDirectory"],
      title: "Pick folder",
    })
  })
})

describe("openNativeOpenDialog", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns file item for openFile dialog", async () => {
    const showOpenDialog = vi.fn().mockResolvedValue({
      canceled: false,
      filePaths: ["/media/ep01.mkv"],
    })
    vi.stubGlobal("window", { electron: { dialog: { showOpenDialog } } })

    await expect(
      openNativeOpenDialog({
        properties: ["openFile"],
        title: "Select Video File",
      }),
    ).resolves.toEqual({
      name: "ep01.mkv",
      path: "/media/ep01.mkv",
      isDirectory: false,
    })
  })
})
