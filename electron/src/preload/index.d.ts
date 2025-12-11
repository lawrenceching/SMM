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

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}
