import type { ContextBridge, IpcRenderer } from "electron"
import { createDialogPreloadApi } from "./dialogApi"
import { createExecuteChannelPreloadApi } from "./executeChannelApi"
import { createFileAccessPersistPreloadApi } from "./fileAccessPersistApi"

export { createDialogPreloadApi, type DialogPreloadApi } from "./dialogApi"
export {
  createExecuteChannelPreloadApi,
  type ExecuteChannelPreloadApi,
} from "./executeChannelApi"
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

export function createWindowApi(ipcRenderer: IpcRenderer) {
  return createExecuteChannelPreloadApi(ipcRenderer)
}

export function exposeDialogPreload(
  contextBridge: ContextBridge,
  ipcRenderer: IpcRenderer,
): void {
  contextBridge.exposeInMainWorld("electron", createElectronPreloadApi(ipcRenderer))
}
