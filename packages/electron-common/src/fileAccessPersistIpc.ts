import { systemPreferences } from "electron"
import type { IpcMain } from "electron"
import { FILE_ACCESS_PERSIST_CHANNEL } from "./channels"

export interface FileAccessPersistRequest {
  paths: string[]
}

export interface FileAccessPersistResponse {
  ok: boolean
  skipped?: boolean
}

type HarmonyOSSystemPreferences = typeof systemPreferences & {
  fileAccessPersist?: (paths: string[]) => void
  callArkTSFunction?: (name: string, returnType: string, args: unknown[]) => unknown
}

const SAVE_URIS_BINDING = "PermissionManagerAdapter.SaveUris"

function isHarmonyOSElectron(): boolean {
  return process.platform === "ohos"
}

function validatePaths(paths: unknown): string[] {
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new Error("fileAccess:persist requires a non-empty paths array")
  }
  if (!paths.every((p) => typeof p === "string" && p.length > 0)) {
    throw new Error("fileAccess:persist paths must be non-empty strings")
  }
  return paths
}

export function registerFileAccessPersistIpcHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    FILE_ACCESS_PERSIST_CHANNEL,
    async (_event, payload: FileAccessPersistRequest): Promise<FileAccessPersistResponse> => {
      const paths = validatePaths(payload?.paths)

      if (!isHarmonyOSElectron()) {
        return { ok: true, skipped: true }
      }

      const sp = systemPreferences as HarmonyOSSystemPreferences
      if (typeof sp.fileAccessPersist !== "function") {
        throw new Error("systemPreferences.fileAccessPersist is not available on this platform")
      }

      try {
        sp.fileAccessPersist(paths)
      } catch (err) {
        console.error("[electron-common] systemPreferences.fileAccessPersist failed:", err)
        throw err
      }

      if (typeof sp.callArkTSFunction === "function") {
        try {
          sp.callArkTSFunction(SAVE_URIS_BINDING, "void", [paths])
        } catch (err) {
          console.error("[electron-common] SaveUris via callArkTSFunction failed:", err)
          throw err
        }
      }

      return { ok: true }
    },
  )
}
