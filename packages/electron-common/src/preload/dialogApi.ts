import type { IpcRenderer } from "electron"
import {
  DIALOG_SHOW_OPEN_CHANNEL,
  DIALOG_SHOW_SAVE_CHANNEL,
} from "../channels"

export interface DialogPreloadApi {
  showOpenDialog: (
    options: Electron.OpenDialogOptions,
  ) => Promise<Electron.OpenDialogReturnValue>
  showSaveDialog: (
    options: Electron.SaveDialogOptions,
  ) => Promise<Electron.SaveDialogReturnValue>
}

export function createDialogPreloadApi(ipcRenderer: IpcRenderer): DialogPreloadApi {
  return {
    showOpenDialog: (options) => ipcRenderer.invoke(DIALOG_SHOW_OPEN_CHANNEL, options),
    showSaveDialog: (options) => ipcRenderer.invoke(DIALOG_SHOW_SAVE_CHANNEL, options),
  }
}
