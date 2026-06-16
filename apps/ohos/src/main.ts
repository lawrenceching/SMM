import { app, ipcMain, session } from "electron"
import { registerDialogIpcHandlers, registerExecuteChannelIpcHandlers } from "@smm/electron-common"
import { startMainHttpServer } from "./http/server"
import { registerOhosFileAccessPermission } from "./ipc/file-access-permission"
import { initAppRoot } from "./paths"
import { getAllowedRootItems, resolveRedirect } from "./redirect/file-protocol-redirect"
import { createMainWindow } from "./window/create-main-window"

registerDialogIpcHandlers(ipcMain)
registerExecuteChannelIpcHandlers(ipcMain)
registerOhosFileAccessPermission(ipcMain)

app.whenReady().then(() => {
  initAppRoot(app.getAppPath())

  getAllowedRootItems()

  void startMainHttpServer().catch((err) => {
    console.error("[main] failed to start HTTP server:", err)
  })

  session.defaultSession.webRequest.onBeforeRequest((details, cb) => {
    const redirect = resolveRedirect(details.url)
    if (redirect && redirect !== details.url) {
      cb({ redirectURL: redirect })
    } else {
      cb({ cancel: false })
    }
  })

  createMainWindow()
})
