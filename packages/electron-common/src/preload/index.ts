import type { ContextBridge, IpcRenderer } from "electron"
import { createDialogPreloadApi } from "./dialogApi"
import { createFileAccessPersistPreloadApi } from "./fileAccessPersistApi"

export { createDialogPreloadApi, type DialogPreloadApi } from "./dialogApi"
export {
  createFileAccessPersistPreloadApi,
  type FileAccessPersistPreloadApi,
} from "./fileAccessPersistApi"

export function createElectronPreloadApi(ipcRenderer: IpcRenderer) {
  return {
    dialog: createDialogPreloadApi(ipcRenderer),
    fileAccess: createFileAccessPersistPreloadApi(ipcRenderer),
  }
}

export function exposeDialogPreload(
  contextBridge: ContextBridge,
  ipcRenderer: IpcRenderer,
): void {
  contextBridge.exposeInMainWorld("electron", createElectronPreloadApi(ipcRenderer))
}
