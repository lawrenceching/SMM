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
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}
