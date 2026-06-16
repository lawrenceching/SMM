import { shell, systemPreferences } from "electron"

export interface OpenInFileManagerResult {
  success: boolean
  error?: unknown
}

type HarmonyOSSystemPreferences = typeof systemPreferences & {
  callArkTSFunction?: (name: string, returnType: string, args: unknown[]) => unknown
}

const OPEN_ITEM_IN_FOLDER_BINDING = "EtsBridge.OpenItemInFolder"

function isHarmonyOSElectron(): boolean {
  const platform = process.platform as string
  return platform === "ohos" || platform === "openharmony"
}

function openItemInFolderViaNativeBinding(path: string): boolean {
  const sp = systemPreferences as HarmonyOSSystemPreferences
  if (typeof sp.callArkTSFunction !== "function") {
    console.warn("[OpenInFileManager] callArkTSFunction unavailable; skipped native fallback")
    return false
  }

  try {
    const result = sp.callArkTSFunction(OPEN_ITEM_IN_FOLDER_BINDING, "boolean", [path])
    return result === true
  } catch (err) {
    console.error("[OpenInFileManager] EtsBridge.OpenItemInFolder fallback failed:", err)
    return false
  }
}

function shellShowItemError(result: unknown): string | null {
  if (typeof result === "string" && result.length > 0) {
    return result
  }
  return null
}

/**
 * Open a folder in the system file manager.
 * On HarmonyOS, falls back to EtsBridge.OpenItemInFolder → FileManagerAdapter.OpenItemInFolder
 * when shell.showItemInFolder fails.
 */
export async function openInFileManager(path: string): Promise<OpenInFileManagerResult> {
  if (!path || typeof path !== "string") {
    return { success: false, error: "Path is required and must be a string" }
  }

  try {
    const result = await shell.showItemInFolder(path)
    const shellError = shellShowItemError(result)
    if (shellError) {
      throw new Error(shellError)
    }
    console.log(`[OpenInFileManager] Opened folder: ${path}`)
    return { success: true }
  } catch (shellErr) {
    if (!isHarmonyOSElectron()) {
      console.error("[OpenInFileManager] Error opening folder in system file manager:", shellErr)
      return { success: false, error: shellErr }
    }

    console.warn(
      "[OpenInFileManager] shell.showItemInFolder failed, trying FileManagerAdapter fallback:",
      shellErr,
    )
    if (openItemInFolderViaNativeBinding(path)) {
      console.log(`[OpenInFileManager] Opened folder via native fallback: ${path}`)
      return { success: true }
    }

    console.error("[OpenInFileManager] Native fallback failed:", shellErr)
    return { success: false, error: shellErr }
  }
}
