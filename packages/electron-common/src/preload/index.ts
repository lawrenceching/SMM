import type { ContextBridge, IpcRenderer } from "electron"
import { createDialogPreloadApi } from "./dialogApi"
import { createExecuteChannelPreloadApi } from "./executeChannelApi"
import { createFileAccessPersistPreloadApi } from "./fileAccessPersistApi"
import {
  createGetPathForFilePreloadApi,
  type WebUtilsGetPathForFile,
} from "./getPathForFileApi"

export { createDialogPreloadApi, type DialogPreloadApi } from "./dialogApi"
export {
  createExecuteChannelPreloadApi,
  type ExecuteChannelPreloadApi,
} from "./executeChannelApi"
export {
  createFileAccessPersistPreloadApi,
  type FileAccessPersistPreloadApi,
} from "./fileAccessPersistApi"
export {
  createGetPathForFilePreloadApi,
  type GetPathForFilePreloadApi,
  type WebUtilsGetPathForFile,
} from "./getPathForFileApi"
export { STARTUP_OPEN_LOG_DIR_CHANNEL } from "../channels"

export function createElectronPreloadApi(ipcRenderer: IpcRenderer) {
  return {
    dialog: createDialogPreloadApi(ipcRenderer),
    fileAccess: createFileAccessPersistPreloadApi(ipcRenderer),
  }
}

export function createWindowApi(
  ipcRenderer: IpcRenderer,
  webUtils?: WebUtilsGetPathForFile,
) {
  return {
    ...createExecuteChannelPreloadApi(ipcRenderer),
    ...(webUtils ? createGetPathForFilePreloadApi(webUtils) : {}),
  }
}

export function exposeDialogPreload(
  contextBridge: ContextBridge,
  ipcRenderer: IpcRenderer,
): void {
  contextBridge.exposeInMainWorld("electron", createElectronPreloadApi(ipcRenderer))
}
