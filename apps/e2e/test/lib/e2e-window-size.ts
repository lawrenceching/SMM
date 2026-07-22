/**
 * Shared e2e window sizing for local browser, Electron, and HarmonyOS (ohos).
 *
 * Chrome's --window-size does not reliably set the WebDriver window (especially
 * headless), so apply via setWindowSize in each platform's WDIO `before` hook.
 * Default 1920x1080 keeps container-query layouts (e.g. Recognize ≥410px) wide
 * enough across platforms.
 *
 * On Windows high-DPI (e.g. 4K @ 200%), the logical work area is often ~1920x1080
 * already, so a hard 1920x1080 outer window overflows — use fitToScreen locally.
 * Local headed Chrome also uses --force-device-scale-factor=1 in wdio.conf.ts.
 *
 * Electron: WebDriver `setWindowSize` fails (`Browser.getWindowForTarget` missing).
 * Prefer `browser.electron.execute` → BrowserWindow.setSize; fall back to Puppeteer
 * viewport override so CSS/container queries still see the target width.
 */
import { browser } from '@wdio/globals'

export const DEFAULT_E2E_WINDOW_WIDTH = 1920
export const DEFAULT_E2E_WINDOW_HEIGHT = 1080

export function resolveE2eWindowSize(): { width: number; height: number } {
  const widthEnv = process.env.E2E_WINDOW_WIDTH
  const heightEnv = process.env.E2E_WINDOW_HEIGHT
  if (widthEnv && heightEnv) {
    const width = Number(widthEnv)
    const height = Number(heightEnv)
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      return { width, height }
    }
  }
  return { width: DEFAULT_E2E_WINDOW_WIDTH, height: DEFAULT_E2E_WINDOW_HEIGHT }
}

/** Clamp the target outer window size to the browser-reported work area (CSS/DIP pixels). */
export function fitE2eWindowSizeToScreen(
  target: { width: number; height: number },
  screenAvail: { availWidth: number; availHeight: number },
): { width: number; height: number } {
  const availWidth = Math.max(1, Math.floor(screenAvail.availWidth))
  const availHeight = Math.max(1, Math.floor(screenAvail.availHeight))
  return {
    width: Math.min(target.width, availWidth),
    height: Math.min(target.height, availHeight),
  }
}

/** CI/docker headless may report a tiny virtual screen (e.g. 800x600) before resize;
 *  clamping there would permanently shrink the target viewport. */
export function shouldFitE2eWindowToScreen(): boolean {
  return process.env.BUILD_ENV !== 'docker'
}

export function resolveAppliedE2eWindowSize(
  target: { width: number; height: number },
  screenAvail: { availWidth: number; availHeight: number },
  options: { fitToScreen: boolean },
): { width: number; height: number } {
  if (!options.fitToScreen) {
    return target
  }
  return fitE2eWindowSizeToScreen(target, screenAvail)
}

type ElectronBrowser = WebdriverIO.Browser & {
  electron?: {
    execute: <ReturnValue, Args extends unknown[]>(
      script: string | ((electron: ElectronMainApi, ...args: Args) => ReturnValue),
      ...args: Args
    ) => Promise<ReturnValue>
  }
}

/** Minimal Electron main-process surface used for window resize. */
type ElectronMainApi = {
  BrowserWindow: {
    getFocusedWindow: () => ElectronBrowserWindow | null
    getAllWindows: () => ElectronBrowserWindow[]
  }
}

type ElectronBrowserWindow = {
  setSize: (width: number, height: number) => void
  getBounds: () => { width: number; height: number }
}

async function applyViaWebDriverWindowSize(size: {
  width: number
  height: number
}): Promise<void> {
  await browser.setWindowSize(size.width, size.height)
}

async function applyViaElectronBrowserWindow(size: {
  width: number
  height: number
}): Promise<{ width: number; height: number }> {
  const electronBrowser = browser as ElectronBrowser
  if (!electronBrowser.electron?.execute) {
    throw new Error('browser.electron.execute is not available')
  }

  return electronBrowser.electron.execute(
    (electron, width, height) => {
      const win =
        electron.BrowserWindow.getFocusedWindow() ?? electron.BrowserWindow.getAllWindows()[0]
      if (!win) {
        throw new Error('No Electron BrowserWindow available to resize')
      }
      win.setSize(width, height)
      return win.getBounds()
    },
    size.width,
    size.height,
  )
}

/** Layout viewport override when the OS/BrowserWindow cannot be resized via WebDriver. */
async function applyViaPuppeteerViewport(size: {
  width: number
  height: number
}): Promise<void> {
  const puppeteerBrowser = await browser.getPuppeteer()
  const pages = await puppeteerBrowser.pages()
  const page = pages[0]
  if (!page) {
    throw new Error('No Puppeteer page available for viewport override')
  }
  await page.setViewport({
    width: size.width,
    height: size.height,
    deviceScaleFactor: 1,
  })
}

function isElectronE2ePlatform(): boolean {
  return process.env.E2E_PLATFORM === 'electron'
}

export async function applyE2eWindowSize(): Promise<void> {
  const target = resolveE2eWindowSize()
  const fitToScreen = shouldFitE2eWindowToScreen()
  const screenAvail = await browser.execute(() => ({
    availWidth: window.screen.availWidth,
    availHeight: window.screen.availHeight,
    devicePixelRatio: window.devicePixelRatio,
  }))
  const size = resolveAppliedE2eWindowSize(target, screenAvail, { fitToScreen })

  let method = 'setWindowSize'
  try {
    if (isElectronE2ePlatform()) {
      try {
        const bounds = await applyViaElectronBrowserWindow(size)
        method = `electron.BrowserWindow.setSize→${bounds.width}x${bounds.height}`
      } catch (electronErr) {
        console.warn(
          '[E2E] electron.BrowserWindow.setSize failed, falling back to Puppeteer viewport:',
          electronErr instanceof Error ? electronErr.message : electronErr,
        )
        await applyViaPuppeteerViewport(size)
        method = 'puppeteer.setViewport'
      }
    } else {
      try {
        await applyViaWebDriverWindowSize(size)
      } catch (wdErr) {
        console.warn(
          '[E2E] setWindowSize failed, falling back to Puppeteer viewport:',
          wdErr instanceof Error ? wdErr.message : wdErr,
        )
        await applyViaPuppeteerViewport(size)
        method = 'puppeteer.setViewport'
      }
    }
  } catch (err) {
    console.error(
      '[E2E] applyE2eWindowSize failed:',
      err instanceof Error ? err.message : err,
    )
    throw err
  }

  let rect: { width?: number; height?: number } = {}
  try {
    rect = await browser.getWindowRect()
  } catch {
    // Electron often cannot report window rect via WebDriver either.
  }

  console.log(
    `[E2E] window size method=${method} target=${target.width}x${target.height} ` +
      `fitted=${size.width}x${size.height} fitToScreen=${fitToScreen}; ` +
      `getWindowRect=${rect.width ?? '?'}x${rect.height ?? '?'}; ` +
      `screenAvail=${screenAvail.availWidth}x${screenAvail.availHeight} ` +
      `dpr=${screenAvail.devicePixelRatio}; ` +
      `inner=${await browser.execute(() => `${window.innerWidth}x${window.innerHeight}`)}`,
  )
}
