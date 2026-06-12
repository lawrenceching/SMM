import type { IpcRenderer } from "electron"
import { FILE_ACCESS_ACTIVATE_CHANNEL, FILE_ACCESS_PERSIST_CHANNEL } from "../channels"
import type {
  FileAccessPersistRequest,
  FileAccessPersistResponse,
} from "../fileAccessPersistIpc"

export interface FileAccessPersistPreloadApi {
  persist: (paths: string[]) => Promise<FileAccessPersistResponse>
  activate: (paths: string[]) => Promise<FileAccessPersistResponse>
}

export function createFileAccessPersistPreloadApi(
  ipcRenderer: IpcRenderer,
): FileAccessPersistPreloadApi {
  return {
    persist: (paths) =>
      ipcRenderer.invoke(FILE_ACCESS_PERSIST_CHANNEL, {
        paths,
      } satisfies FileAccessPersistRequest),
    activate: (paths) =>
      ipcRenderer.invoke(FILE_ACCESS_ACTIVATE_CHANNEL, {
        paths,
      } satisfies FileAccessPersistRequest),
  }
}
