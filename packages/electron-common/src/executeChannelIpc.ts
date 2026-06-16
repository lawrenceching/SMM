import type { IpcMain } from "electron"
import { EXECUTE_CHANNEL, OPEN_FILE_CHANNEL, OPEN_IN_FILE_MANAGER_CHANNEL } from "./channels"
import { openFileWithShell } from "./openFileTask"
import { openInFileManager } from "./openInFileManagerTask"

export interface ExecuteChannelRequest {
  name: string
  data: unknown
}

export interface ExecuteChannelResponse {
  name: string
  data: unknown
}

export interface RegisterExecuteChannelOptions {
  getConfig?: () => Promise<unknown>
}

export async function routeExecuteChannel(
  request: ExecuteChannelRequest,
  options: RegisterExecuteChannelOptions = {},
): Promise<ExecuteChannelResponse> {
  switch (request.name) {
    case OPEN_IN_FILE_MANAGER_CHANNEL:
      return {
        name: OPEN_IN_FILE_MANAGER_CHANNEL,
        data: await openInFileManager(String(request.data ?? "")),
      }
    case OPEN_FILE_CHANNEL:
      return {
        name: OPEN_FILE_CHANNEL,
        data: await openFileWithShell(String(request.data ?? "")),
      }
    case "get-config":
      if (!options.getConfig) {
        throw new Error(`Unknown channel: ${request.name}`)
      }
      return {
        name: "get-config",
        data: await options.getConfig(),
      }
    default:
      throw new Error(`Unknown channel: ${request.name}`)
  }
}

export function registerExecuteChannelIpcHandlers(
  ipcMain: IpcMain,
  options: RegisterExecuteChannelOptions = {},
): void {
  ipcMain.handle(EXECUTE_CHANNEL, async (_event, request: ExecuteChannelRequest) => {
    return routeExecuteChannel(request, options)
  })
}
