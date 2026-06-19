import { shell, systemPreferences } from "electron"
import type { BrowserWindow } from "electron"

const LOG_PREFIX = "[OpenExternalUrl]"
const OPEN_URL_IN_DEFAULT_BROWSER_BINDING = "FileManagerAdapter.OpenUrlInDefaultBrowser"

type HarmonyOSSystemPreferences = typeof systemPreferences & {
  callArkTSFunction?: (name: string, returnType: string, args: unknown[]) => unknown
}

function isHarmonyOSElectron(): boolean {
  const platform = process.platform as string
  return platform === "ohos" || platform === "openharmony"
}

function openUrlViaNativeBinding(url: string): boolean {
  const sp = systemPreferences as HarmonyOSSystemPreferences
  if (typeof sp.callArkTSFunction !== "function") {
    console.warn(`${LOG_PREFIX} callArkTSFunction unavailable; skipped native fallback`)
    return false
  }

  try {
    sp.callArkTSFunction(OPEN_URL_IN_DEFAULT_BROWSER_BINDING, "void", [url])
    return true
  } catch (err) {
    console.error(`${LOG_PREFIX} ${OPEN_URL_IN_DEFAULT_BROWSER_BINDING} fallback failed:`, err)
    return false
  }
}

/**
 * Route every `window.open(url, ...)` and `<a target="_blank" href="...">` click
 * from this BrowserWindow to the system browser instead of spawning a child
 * Electron window.
 *
 * - Desktop Electron: `shell.openExternal(url)` opens the URL in the system
 *   default browser.
 * - HarmonyOS Electron: `shell.openExternal` does not delegate to the system
 *   browser. On failure, fall back to the ArkTS binding
 *   `FileManagerAdapter.OpenUrlInDefaultBrowser`, which launches a Want with
 *   `action: ohos.want.action.viewData` + `entity.system.browsable` to open
 *   the URL in the default browser.
 *
 * The handler always returns `{ action: "deny" }` so the child window is
 * blocked regardless of which path succeeds.
 */
export function setExternalUrlOpenHandler(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler((details) => {
    void (async () => {
      try {
        await shell.openExternal(details.url)
        console.log(`${LOG_PREFIX} Opened via shell.openExternal: ${details.url}`)
      } catch (shellErr) {
        if (!isHarmonyOSElectron()) {
          console.error(`${LOG_PREFIX} shell.openExternal failed:`, shellErr)
          return
        }

        console.warn(
          `${LOG_PREFIX} shell.openExternal failed, trying ${OPEN_URL_IN_DEFAULT_BROWSER_BINDING}:`,
          shellErr,
        )
        if (openUrlViaNativeBinding(details.url)) {
          console.log(`${LOG_PREFIX} Opened via native fallback: ${details.url}`)
        } else {
          console.error(`${LOG_PREFIX} Native fallback failed for: ${details.url}`)
        }
      }
    })()
    return { action: "deny" }
  })
}
