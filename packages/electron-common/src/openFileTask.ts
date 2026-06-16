import { shell } from "electron"

export interface OpenFileResult {
  success: boolean
  error?: unknown
}

/**
 * Open a file with the system default application via shell.openPath.
 * Returns empty string on success; returns an error message string on failure.
 */
export async function openFileWithShell(path: string): Promise<OpenFileResult> {
  if (!path || typeof path !== "string") {
    return { success: false, error: "Path is required and must be a string" }
  }

  try {
    const result = await shell.openPath(path)
    if (result === "") {
      console.log(`[OpenFile] Opened file: ${path}`)
      return { success: true }
    }

    console.error(`[OpenFile] shell.openPath failed for ${path}: ${result}`)
    return { success: false, error: result }
  } catch (err) {
    console.error(`[OpenFile] Error opening file: ${path}`, err)
    return { success: false, error: err }
  }
}
