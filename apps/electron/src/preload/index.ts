import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  createDialogPreloadApi,
  createFileAccessPersistPreloadApi,
  createWindowApi,
} from '@smm/electron-common/preload'

// Custom APIs for renderer
const api = createWindowApi(ipcRenderer, webUtils)

const dialogAPI = createDialogPreloadApi(ipcRenderer)
const fileAccessAPI = createFileAccessPersistPreloadApi(ipcRenderer)

console.log('[Preload] API object created:', { hasGetPathForFile: typeof api.getPathForFile === 'function' })

// Merge electronAPI with dialog API
const enhancedElectronAPI = {
  ...electronAPI,
  dialog: dialogAPI,
  fileAccess: fileAccessAPI,
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', enhancedElectronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = enhancedElectronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
