import { systemPreferences } from "electron"
import type { IpcMain } from "electron"
import { FILE_ACCESS_ACTIVATE_CHANNEL, FILE_ACCESS_PERSIST_CHANNEL } from "./channels"

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

const REACTIVATE_FOLDERS_BINDING = "PermissionManagerAdapter.ReactivateFolders"

function isHarmonyOSElectron(): boolean {
  return process.platform === "ohos" || process.platform === "openharmony"
}

function validatePaths(paths: unknown): string[] {
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new Error("fileAccess paths requires a non-empty paths array")
  }
  if (!paths.every((p) => typeof p === "string" && p.length > 0)) {
    throw new Error("fileAccess paths must be non-empty strings")
  }
  return paths
}

function callReactivateFolders(paths: string[]): void {
  const sp = systemPreferences as HarmonyOSSystemPreferences
  if (typeof sp.callArkTSFunction !== "function") {
    console.warn("[electron-common] callArkTSFunction unavailable; skipped ReactivateFolders")
    return
  }

  sp.callArkTSFunction(REACTIVATE_FOLDERS_BINDING, "void", [paths])
}

/** Re-activate persisted HarmonyOS folder access (e.g. from smm.json on startup). */
export function activateHarmonyOSFileAccess(paths: string[]): void {
  if (!isHarmonyOSElectron()) {
    return
  }

  callReactivateFolders(validatePaths(paths))
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

      sp.fileAccessPersist(paths)
      callReactivateFolders(paths)

      return { ok: true }
    },
  )

  ipcMain.handle(
    FILE_ACCESS_ACTIVATE_CHANNEL,
    async (_event, payload: FileAccessPersistRequest): Promise<FileAccessPersistResponse> => {
      const paths = validatePaths(payload?.paths)

      if (!isHarmonyOSElectron()) {
        return { ok: true, skipped: true }
      }

      callReactivateFolders(paths)
      return { ok: true }
    },
  )
}
