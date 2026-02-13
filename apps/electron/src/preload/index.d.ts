import { ElectronAPI } from '@electron-toolkit/preload'

interface ExecuteChannelRequest {
  name: string
  data: any
}

interface ExecuteChannelResponse {
  name: string
  data: any
}

interface API {
  executeChannel: (request: ExecuteChannelRequest) => Promise<ExecuteChannelResponse>
  getPathForFile: (file: File) => string | null
}

interface DialogAPI {
  showOpenDialog: (options: Electron.OpenDialogOptions) => Promise<Electron.OpenDialogReturnValue>
}

interface EnhancedElectronAPI extends ElectronAPI {
  dialog: DialogAPI
}

declare global {
  interface Window {
    electron: EnhancedElectronAPI
    api: API
  }
}
