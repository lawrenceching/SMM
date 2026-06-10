import type { ContextBridge, IpcRenderer } from "electron"
import { createDialogPreloadApi } from "./dialogApi"

export { createDialogPreloadApi, type DialogPreloadApi } from "./dialogApi"

export function exposeDialogPreload(
  contextBridge: ContextBridge,
  ipcRenderer: IpcRenderer,
): void {
  contextBridge.exposeInMainWorld("electron", {
    dialog: createDialogPreloadApi(ipcRenderer),
  })
}
