import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

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
      // Use webUtils.getPathForFile to get the file path
      // This works for File objects from drag and drop in Electron
      const path = webUtils.getPathForFile(file)
      console.log('[Preload] webUtils.getPathForFile returned:', path)
      return path
    } catch (error) {
      console.error('[Preload] Failed to get path for file:', error)
      return null
    }
  }
}

// Dialog API exposed via IPC
const dialogAPI = {
  showOpenDialog: (options: Electron.OpenDialogOptions): Promise<Electron.OpenDialogReturnValue> => {
    console.log('[Preload] dialog.showOpenDialog called with options:', options)
    return ipcRenderer.invoke('dialog:showOpenDialog', options)
  }
}

console.log('[Preload] API object created:', { hasGetPathForFile: typeof api.getPathForFile === 'function' })

// Merge electronAPI with dialog API
const enhancedElectronAPI = {
  ...electronAPI,
  dialog: dialogAPI
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
