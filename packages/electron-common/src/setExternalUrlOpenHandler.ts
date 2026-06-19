import { shell } from "electron"
import type { BrowserWindow } from "electron"

/**
 * Route every `window.open(url, ...)` from this BrowserWindow to the system
 * browser via `shell.openExternal` instead of spawning a child Electron window.
 *
 * Apply once per BrowserWindow after creation. The same renderer code
 * (`window.open(externalUrl, "_blank", "noopener,noreferrer")`) works correctly
 * across desktop Electron and HarmonyOS Electron, where it is otherwise
 * interpreted as a request to create a new child window that cannot navigate
 * to the external URL.
 */
export function setExternalUrlOpenHandler(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: "deny" }
  })
}
