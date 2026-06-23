import { activateOhosFileAccessPermission } from "../ipc/file-access-permission"

/**
 * Injected into `core-routes` so `doListFiles` / MCP `list-files`
 * can re-activate HarmonyOS DocumentViewPicker permissions before
 * reading `file://docs/...` URIs. The renderer does this via IPC
 * on startup; external MCP clients bypass the UI and need the same
 * activation in the main process.
 */
export function activateOhosPersistedFileAccess(paths: string[]): void {
  const result = activateOhosFileAccessPermission(paths, "list-files")
  if (!result.ok && !result.skipped) {
    throw new Error(result.error ?? "Failed to activate HarmonyOS file access")
  }
}
