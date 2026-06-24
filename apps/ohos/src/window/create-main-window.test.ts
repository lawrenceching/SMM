import { describe, expect, it, vi } from "vitest"

const setApplicationMenu = vi.fn()

vi.mock("electron", () => ({
  Menu: { setApplicationMenu },
  BrowserWindow: vi.fn(function BrowserWindow() {
    return {
      setMenuBarVisibility: vi.fn(),
      setWindowButtonVisibility: vi.fn(),
      loadFile: vi.fn(),
      loadURL: vi.fn(),
    }
  }),
  Tray: vi.fn(function Tray() {
    return {}
  }),
  nativeImage: { createFromPath: vi.fn(() => ({})) },
}))

vi.mock("@smm/electron-common", () => ({
  setExternalUrlOpenHandler: vi.fn(),
}))

vi.mock("../paths", () => ({
  getAppRoot: () => "/app",
  getTestIndexPath: () => "/app/test/index.html",
  MAIN_HTTP_ORIGIN: "http://127.0.0.1:30000",
  USE_DEV_PAGE: false,
}))

describe("createMainWindow", () => {
  it("clears Electron default application menu", async () => {
    setApplicationMenu.mockClear()
    const { createMainWindow } = await import("./create-main-window")
    createMainWindow()
    expect(setApplicationMenu).toHaveBeenCalledWith(null)
  })
})
