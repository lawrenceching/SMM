import path from "node:path"
import { BrowserWindow, Menu, Tray, nativeImage } from "electron"
import { setExternalUrlOpenHandler } from "@smm/electron-common"
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

/** Remove Electron's default File/Edit/View application menu on HarmonyOS. */
export function hideElectronDefaultMenu(): void {
  Menu.setApplicationMenu(null)
}

export function createMainWindow(): MainWindowResult {
  const iconPath = path.join(getAppRoot(), "icon.png")
  const tray = new Tray(nativeImage.createFromPath(iconPath))
  hideElectronDefaultMenu()
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: "SMM",
    icon: iconPath,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(getAppRoot(), "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  mainWindow.setMenuBarVisibility(false)
  mainWindow.setWindowButtonVisibility(true)
  setExternalUrlOpenHandler(mainWindow)

  if (USE_DEV_PAGE) {
    void mainWindow.loadFile(getTestIndexPath())
  } else {
    void mainWindow.loadURL(`${MAIN_HTTP_ORIGIN}/`)
  }

  return { mainWindow, tray }
}
