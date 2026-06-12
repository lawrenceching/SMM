import path from "node:path"
import { BrowserWindow, Tray, nativeImage } from "electron"
import {
  getAppRoot,
  getTestIndexPath,
  MAIN_HTTP_ORIGIN,
  USE_DEV_PAGE,
} from "../paths"

export interface MainWindowResult {
  mainWindow: BrowserWindow
  tray: Tray
}

export function createMainWindow(): MainWindowResult {
  const tray = new Tray(nativeImage.createFromPath(path.join(getAppRoot(), "electron_white.png")))
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(getAppRoot(), "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  mainWindow.setWindowButtonVisibility(true)

  if (USE_DEV_PAGE) {
    void mainWindow.loadFile(getTestIndexPath())
  } else {
    void mainWindow.loadURL(`${MAIN_HTTP_ORIGIN}/`)
  }

  return { mainWindow, tray }
}
