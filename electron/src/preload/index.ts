import { contextBridge, ipcRenderer } from 'electron'
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
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
