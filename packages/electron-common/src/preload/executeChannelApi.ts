import type { IpcRenderer } from "electron"
import { EXECUTE_CHANNEL } from "../channels"
import type { ExecuteChannelRequest, ExecuteChannelResponse } from "../executeChannelIpc"

export interface ExecuteChannelPreloadApi {
  executeChannel: (request: ExecuteChannelRequest) => Promise<ExecuteChannelResponse>
}

export function createExecuteChannelPreloadApi(
  ipcRenderer: IpcRenderer,
): ExecuteChannelPreloadApi {
  return {
    executeChannel: (request: ExecuteChannelRequest): Promise<ExecuteChannelResponse> => {
      return ipcRenderer.invoke(EXECUTE_CHANNEL, request) as Promise<ExecuteChannelResponse>
    },
  }
}
