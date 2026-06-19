import type { BrowserWindow } from "electron"
import { afterEach, describe, expect, it, vi } from "vitest"
import { setExternalUrlOpenHandler } from "./setExternalUrlOpenHandler"

const setWindowOpenHandler = vi.fn()
const openExternal = vi.fn<(url: string) => Promise<void>>(async () => undefined)
const callArkTSFunction = vi.fn()

vi.mock("electron", () => ({
  shell: {
    openExternal: (url: string) => openExternal(url),
  },
  systemPreferences: {
    callArkTSFunction: (name: string, returnType: string, args: unknown[]) =>
      callArkTSFunction(name, returnType, args),
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

type OpenHandler = (details: { url: string }) => { action: "deny" | "allow" }

function getRegisteredHandler(): OpenHandler {
  const handler = setWindowOpenHandler.mock.calls[0]?.[0] as OpenHandler | undefined
  if (!handler) {
    throw new Error("expected setWindowOpenHandler to be registered")
  }
  return handler
}

/**
 * Replace process.platform for the duration of `fn`, restoring the previous
 * value afterwards. Mirrors the pattern used in executeChannelIpc.test.ts.
 */
function withPlatform<T>(value: string, fn: () => Promise<T> | T): Promise<T> {
  const original = process.platform
  Object.defineProperty(process, "platform", { value, configurable: true })
  return Promise.resolve(fn()).finally(() => {
    Object.defineProperty(process, "platform", { value: original, configurable: true })
  })
}

async function flushMicrotasks(): Promise<void> {
  // The handler fires the async work via `void (async () => { ... })()`. Two
  // microtask flushes are enough for the shell.openExternal try/catch to
  // settle on both success and rejection paths in vitest.
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe("setExternalUrlOpenHandler", () => {
  afterEach(() => {
    setWindowOpenHandler.mockClear()
    openExternal.mockClear()
    callArkTSFunction.mockClear()
    openExternal.mockResolvedValue(undefined)
  })

  it("registers a window open handler on the BrowserWindow", () => {
    const win = makeWindow()

    setExternalUrlOpenHandler(win as unknown as BrowserWindow)

    expect(setWindowOpenHandler).toHaveBeenCalledTimes(1)
    const handler = setWindowOpenHandler.mock.calls[0]?.[0]
    expect(typeof handler).toBe("function")
  })

  it("routes the url to shell.openExternal and denies the child window", async () => {
    const win = makeWindow()
    setExternalUrlOpenHandler(win as unknown as BrowserWindow)
    const handler = getRegisteredHandler()

    const result = handler({ url: "https://www.themoviedb.org/tv/123" })

    expect(result).toEqual({ action: "deny" })
    expect(openExternal).toHaveBeenCalledWith("https://www.themoviedb.org/tv/123")

    await flushMicrotasks()
    expect(callArkTSFunction).not.toHaveBeenCalled()
  })

  it("returns deny synchronously without awaiting shell.openExternal", () => {
    const win = makeWindow()
    setExternalUrlOpenHandler(win as unknown as BrowserWindow)
    const handler = getRegisteredHandler()

    // The handler must return synchronously so Electron can deny the window
    // before any pending microtask; if it awaited, the child window would
    // briefly open.
    const returned = handler({ url: "https://example.com" })
    expect(returned).toEqual({ action: "deny" })
  })

  it("falls back to FileManagerAdapter.OpenUrlInDefaultBrowser on HarmonyOS when shell.openExternal fails", async () => {
    await withPlatform("ohos", async () => {
      openExternal.mockRejectedValue(new Error("shell not supported"))
      callArkTSFunction.mockReturnValue(undefined)

      const win = makeWindow()
      setExternalUrlOpenHandler(win as unknown as BrowserWindow)
      const handler = getRegisteredHandler()

      handler({ url: "https://github.com/lawrenceching/SMM" })

      expect(openExternal).toHaveBeenCalledWith("https://github.com/lawrenceching/SMM")

      await flushMicrotasks()
      expect(callArkTSFunction).toHaveBeenCalledWith(
        "FileManagerAdapter.OpenUrlInDefaultBrowser",
        "void",
        ["https://github.com/lawrenceching/SMM"],
      )
    })
  })

  it("does not call the native binding when shell.openExternal succeeds on HarmonyOS", async () => {
    await withPlatform("openharmony", async () => {
      const win = makeWindow()
      setExternalUrlOpenHandler(win as unknown as BrowserWindow)
      const handler = getRegisteredHandler()

      handler({ url: "https://example.com" })
      await flushMicrotasks()

      expect(callArkTSFunction).not.toHaveBeenCalled()
    })
  })

  it("does not call the native binding on non-OHOS platforms when shell.openExternal fails", async () => {
    await withPlatform("win32", async () => {
      openExternal.mockRejectedValue(new Error("shell failed"))

      const win = makeWindow()
      setExternalUrlOpenHandler(win as unknown as BrowserWindow)
      const handler = getRegisteredHandler()

      handler({ url: "https://example.com" })
      await flushMicrotasks()

      expect(callArkTSFunction).not.toHaveBeenCalled()
    })
  })

  it("swallows native binding errors on HarmonyOS without throwing", async () => {
    await withPlatform("ohos", async () => {
      openExternal.mockRejectedValue(new Error("shell not supported"))
      callArkTSFunction.mockImplementation(() => {
        throw new Error("arkts boom")
      })

      const win = makeWindow()
      setExternalUrlOpenHandler(win as unknown as BrowserWindow)
      const handler = getRegisteredHandler()

      // Handler must not throw even when both the shell and the native binding fail.
      expect(() => handler({ url: "https://example.com" })).not.toThrow()

      await flushMicrotasks()
      expect(callArkTSFunction).toHaveBeenCalledTimes(1)
    })
  })

  it("skips the native fallback when callArkTSFunction is unavailable", async () => {
    await withPlatform("ohos", async () => {
      openExternal.mockRejectedValue(new Error("shell not supported"))
      callArkTSFunction.mockImplementation(() => {
        throw new Error("callArkTSFunction is not a function")
      })

      const win = makeWindow()
      setExternalUrlOpenHandler(win as unknown as BrowserWindow)
      const handler = getRegisteredHandler()

      handler({ url: "https://example.com" })
      await flushMicrotasks()

      // It was attempted, threw, and the helper did not re-throw.
      expect(callArkTSFunction).toHaveBeenCalledTimes(1)
    })
  })
})
