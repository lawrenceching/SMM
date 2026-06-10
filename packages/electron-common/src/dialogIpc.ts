import { BrowserWindow, dialog } from "electron"
import type { IpcMain, IpcMainInvokeEvent } from "electron"
import { DIALOG_SHOW_OPEN_CHANNEL, DIALOG_SHOW_SAVE_CHANNEL } from "./channels"

export interface RegisterDialogIpcOptions {
  getWindow?: (event: IpcMainInvokeEvent) => BrowserWindow | null
}

function defaultGetWindow(event: IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender)
}

export function registerDialogIpcHandlers(
  ipcMain: IpcMain,
  options?: RegisterDialogIpcOptions,
): void {
  const getWindow = options?.getWindow ?? defaultGetWindow

  ipcMain.handle(DIALOG_SHOW_OPEN_CHANNEL, async (event, openOptions) => {
    const win = getWindow(event)
    try {
      return win
        ? await dialog.showOpenDialog(win, openOptions)
        : await dialog.showOpenDialog(openOptions)
    } catch (err) {
      console.error("[electron-common] dialog:showOpenDialog failed:", err)
      throw err
    }
  })

  ipcMain.handle(DIALOG_SHOW_SAVE_CHANNEL, async (event, saveOptions) => {
    const win = getWindow(event)
    try {
      return win
        ? await dialog.showSaveDialog(win, saveOptions)
        : await dialog.showSaveDialog(saveOptions)
    } catch (err) {
      console.error("[electron-common] dialog:showSaveDialog failed:", err)
      throw err
    }
  })
}
