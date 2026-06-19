import type { BrowserWindow } from "electron"
import { afterEach, describe, expect, it, vi } from "vitest"
import { setExternalUrlOpenHandler } from "./setExternalUrlOpenHandler"

const setWindowOpenHandler = vi.fn()
const openExternal = vi.fn<(url: string) => Promise<void>>(async () => undefined)

vi.mock("electron", () => ({
  shell: {
    openExternal: (url: string) => openExternal(url),
  },
}))

type WebContents = {
  setWindowOpenHandler: (handler: (details: { url: string }) => { action: "deny" | "allow" }) => void
}

type FakeWindow = {
  webContents: WebContents
}

function makeWindow(): FakeWindow {
  return {
    webContents: {
      setWindowOpenHandler: setWindowOpenHandler as unknown as WebContents["setWindowOpenHandler"],
    },
  }
}

describe("setExternalUrlOpenHandler", () => {
  afterEach(() => {
    setWindowOpenHandler.mockClear()
    openExternal.mockClear()
  })

  it("registers a window open handler on the BrowserWindow", () => {
    const win = makeWindow()

    setExternalUrlOpenHandler(win as unknown as BrowserWindow)

    expect(setWindowOpenHandler).toHaveBeenCalledTimes(1)
    const handler = setWindowOpenHandler.mock.calls[0]?.[0] as
      | ((details: { url: string }) => { action: "deny" | "allow" })
      | undefined
    expect(typeof handler).toBe("function")
  })

  it("routes the url to shell.openExternal and denies the child window", () => {
    const win = makeWindow()
    setExternalUrlOpenHandler(win as unknown as BrowserWindow)

    const handler = setWindowOpenHandler.mock.calls[0]?.[0] as
      | ((details: { url: string }) => { action: "deny" | "allow" })
      | undefined
    if (!handler) {
      throw new Error("expected setWindowOpenHandler to be registered")
    }

    const result = handler({ url: "https://www.themoviedb.org/tv/123" })

    expect(openExternal).toHaveBeenCalledWith("https://www.themoviedb.org/tv/123")
    expect(result).toEqual({ action: "deny" })
  })

  it("returns deny synchronously without awaiting shell.openExternal", () => {
    const win = makeWindow()
    setExternalUrlOpenHandler(win as unknown as BrowserWindow)

    const handler = setWindowOpenHandler.mock.calls[0]?.[0] as
      | ((details: { url: string }) => { action: "deny" | "allow" })
      | undefined
    if (!handler) {
      throw new Error("expected setWindowOpenHandler to be registered")
    }

    // The handler must return synchronously so Electron can deny the window
    // before any pending microtask; if it awaited, the child window would
    // briefly open.
    const returned = handler({ url: "https://example.com" })
    expect(returned).toEqual({ action: "deny" })
  })
})
