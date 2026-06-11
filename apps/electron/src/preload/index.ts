import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { createDialogPreloadApi, createFileAccessPersistPreloadApi } from '@smm/electron-common/preload'

interface ExecuteChannelRequest {
  name: string
  data: any
}

interface ExecuteChannelResponse {
  name: string
  data: any
}

// Custom APIs for renderer
const api = {
  executeChannel: (request: ExecuteChannelRequest): Promise<ExecuteChannelResponse> => {
    return ipcRenderer.invoke('ExecuteChannel', request)
  },
  getPathForFile: (file: File): string | null => {
    try {
      console.log('[Preload] getPathForFile called with file:', { name: file.name, type: file.type, size: file.size })
      const path = webUtils.getPathForFile(file)
      console.log('[Preload] webUtils.getPathForFile returned:', path)
      return path
    } catch (error) {
      console.error('[Preload] Failed to get path for file:', error)
      return null
    }
  }
}

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
