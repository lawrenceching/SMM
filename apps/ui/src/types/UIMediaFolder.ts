/**
 * Sidebar / folder list entry without embedding full {@link MediaMetadata}.
 * Used by the future `UIMediaFolderStore` (Zustand).
 */
export type UIMediaFolderStatus =
  | "idle"
  | "pending_for_initialization"
  | "initializing"
  | "ok"
  | "folder_not_found"
  | "error_loading_metadata"
  | "loading"
  | "updating"

export interface UIMediaFolder {
  path: string
  status: UIMediaFolderStatus
  /** Test-only folder; may be handled differently in UI logic. */
  test: boolean
}
