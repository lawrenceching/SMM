import { isHarmonyOS } from "@/lib/isHarmonyOS"

interface FileAccessPersistResult {
  ok: boolean
  skipped?: boolean
}

interface ElectronFileAccessApi {
  persist: (paths: string[]) => Promise<FileAccessPersistResult>
  activate?: (paths: string[]) => Promise<FileAccessPersistResult>
}

function getFileAccessApi(): ElectronFileAccessApi | undefined {
  if (typeof window === "undefined") {
    return undefined
  }
  return (window as Window & { electron?: { fileAccess?: ElectronFileAccessApi } })
    .electron?.fileAccess
}

export async function persistHarmonyOSFileAccess(paths: string[]): Promise<void> {
  if (!isHarmonyOS()) {
    return
  }

  if (!paths.length) {
    throw new Error("无法持久化文件夹访问权限：路径为空")
  }

  const fileAccess = getFileAccessApi()
  if (!fileAccess?.persist) {
    throw new Error("无法持久化文件夹访问权限：electron.fileAccess.persist 不可用")
  }

  const result = await fileAccess.persist(paths)
  if (!result?.ok) {
    throw new Error("无法持久化文件夹访问权限")
  }
}

/** Re-activate persisted folder access when config is loaded (HarmonyOS only). */
export async function reactivateHarmonyOSFileAccess(paths: string[]): Promise<void> {
  if (!isHarmonyOS() || paths.length === 0) {
    return
  }

  const fileAccess = getFileAccessApi()
  if (!fileAccess?.activate) {
    return
  }

  const result = await fileAccess.activate(paths)
  if (!result?.ok) {
    throw new Error("无法重新激活文件夹访问权限")
  }
}
