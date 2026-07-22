import type { UIMediaFolder, UIMediaFolderStatus } from "@/types/UIMediaFolder"

export type UIMediaFolderStoreBridgeSnapshot = {
  path: string
  status: UIMediaFolderStatus
}

/** Minimal state shape needed by the bridge (avoids importing actions). */
export type UIMediaFolderStoreBridgeState = {
  selectedFolder: string
  folders: Pick<UIMediaFolder, "path" | "status" | "test">[]
}

export function selectSelectedFolderSnapshot(
  state: UIMediaFolderStoreBridgeState,
): UIMediaFolderStoreBridgeSnapshot | null {
  const path = state.selectedFolder
  if (!path) return null
  const folder = state.folders.find((f) => f.path === path)
  if (!folder) return null
  return { path: folder.path, status: folder.status }
}

export type UIMediaFolderStoreBridge = {
  getSelectedFolderSnapshot: () => UIMediaFolderStoreBridgeSnapshot | null
}

export function installUIMediaFolderStoreBridge(
  getState: () => UIMediaFolderStoreBridgeState,
): void {
  if (typeof window === "undefined") return
  window.__uiMediaFolderStore = {
    getSelectedFolderSnapshot: () => selectSelectedFolderSnapshot(getState()),
  }
}
