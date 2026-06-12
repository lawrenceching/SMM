import { systemPreferences } from "electron"
import type { IpcMain } from "electron"
import {
  FILE_ACCESS_ACTIVATE_CHANNEL,
  FILE_ACCESS_PERSIST_CHANNEL,
} from "@smm/electron-common"

const LOG_PREFIX = "[ohos-file-access]"
const REACTIVATE_FOLDERS_BINDING = "PermissionManagerAdapter.ReactivateFolders"

type HarmonyOSSystemPreferences = typeof systemPreferences & {
  fileAccessPersist?: (paths: string[]) => void
  callArkTSFunction?: (name: string, returnType: string, args: unknown[]) => unknown
}

export function isHarmonyOSPlatform(): boolean {
  const platform = process.platform as string
  return platform === "ohos" || platform === "openharmony"
}

function logError(message: string, err: unknown): void {
  if (err instanceof Error) {
    console.error(`${LOG_PREFIX} ${message}:`, err.message, err.stack)
    return
  }
  console.error(`${LOG_PREFIX} ${message}:`, err)
}

export function validatePaths(paths: unknown, context: string): string[] {
  if (!Array.isArray(paths)) {
    const message = `paths must be an array (${context})`
    console.error(`${LOG_PREFIX} ${message}`, { paths })
    throw new Error(message)
  }
  if (paths.length === 0) {
    const message = `paths must be non-empty (${context})`
    console.error(`${LOG_PREFIX} ${message}`)
    throw new Error(message)
  }
  if (!paths.every((entry) => typeof entry === "string" && entry.length > 0)) {
    const message = `paths must be non-empty strings (${context})`
    console.error(`${LOG_PREFIX} ${message}`, { paths })
    throw new Error(message)
  }
  return paths
}

function callReactivateFolders(paths: string[], context: string): boolean {
  const sp = systemPreferences as HarmonyOSSystemPreferences
  if (typeof sp.callArkTSFunction !== "function") {
    console.error(`${LOG_PREFIX} callArkTSFunction unavailable (${context})`)
    return false
  }

  try {
    sp.callArkTSFunction(REACTIVATE_FOLDERS_BINDING, "void", [paths])
    return true
  } catch (err) {
    logError(`callReactivateFolders failed (${context})`, err)
    return false
  }
}

export interface ActivateOhosFileAccessResult {
  ok: boolean
  skipped?: boolean
  error?: string
}

/** Dispatch fileShare.activatePermission via ArkTS (non-blocking). */
export function activateOhosFileAccessPermission(
  paths: string[],
  context = "direct",
): ActivateOhosFileAccessResult {
  if (!isHarmonyOSPlatform()) {
    return { ok: true, skipped: true }
  }

  let validated: string[]
  try {
    validated = validatePaths(paths, context)
  } catch (err) {
    logError(`activate validation failed (${context})`, err)
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  if (!callReactivateFolders(validated, context)) {
    const message = `ReactivateFolders dispatch failed (${context})`
    console.error(`${LOG_PREFIX} ${message}`, { paths: validated })
    return { ok: false, error: message }
  }

  return { ok: true }
}

export function registerOhosFileAccessPermission(ipcMain: IpcMain): void {
  if (!ipcMain || typeof ipcMain.handle !== "function") {
    console.error(`${LOG_PREFIX} registerOhosFileAccessPermission: invalid ipcMain`)
    return
  }

  ipcMain.handle(FILE_ACCESS_PERSIST_CHANNEL, async (_event, payload) => {
    let paths: string[]
    try {
      paths = validatePaths(payload?.paths, "IPC-persist")
    } catch (err) {
      logError("IPC persist validation failed", err)
      throw err
    }

    if (!isHarmonyOSPlatform()) {
      return { ok: true, skipped: true }
    }

    const sp = systemPreferences as HarmonyOSSystemPreferences
    if (typeof sp.fileAccessPersist !== "function") {
      const message = "systemPreferences.fileAccessPersist is not available"
      console.error(`${LOG_PREFIX} IPC persist: ${message}`)
      throw new Error(message)
    }

    try {
      sp.fileAccessPersist(paths)
    } catch (err) {
      logError("IPC persist: fileAccessPersist failed", err)
      throw err
    }

    if (!callReactivateFolders(paths, "IPC-persist")) {
      const message = "ReactivateFolders failed after persist"
      console.error(`${LOG_PREFIX} IPC persist: ${message}`, { paths })
      throw new Error(message)
    }

    return { ok: true }
  })

  ipcMain.handle(FILE_ACCESS_ACTIVATE_CHANNEL, async (_event, payload) => {
    let paths: string[]
    try {
      paths = validatePaths(payload?.paths, "IPC-activate")
    } catch (err) {
      logError("IPC activate validation failed", err)
      throw err
    }

    if (!isHarmonyOSPlatform()) {
      return { ok: true, skipped: true }
    }

    if (!callReactivateFolders(paths, "IPC-activate")) {
      const message = "ReactivateFolders dispatch failed"
      console.error(`${LOG_PREFIX} IPC activate: ${message}`, { paths })
      throw new Error(message)
    }

    return { ok: true }
  })
}
