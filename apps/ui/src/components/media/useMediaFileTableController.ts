import { useCallback } from "react"
import { isAbsPath, join } from "@/lib/path"
import { Path } from "@core/path"
import { openFile as openFileApi } from "@/api/openFile"
import { useDialogs } from "@/providers/dialog-provider"
import type {
  UIMediaFileDataRow,
  UIMediaFileFolderRow,
} from "./UIMediaFileTable"

/**
 * Resolves a row's file path (relative to `mediaFolderPath`) to a
 * platform-native absolute path that the OS shell can open.
 *
 * Returns `null` when the path cannot be resolved (e.g. no `mediaFolderPath`
 * and a relative input) — callers treat that as a no-op + log.
 */
function resolveAbsolutePath(
  mediaFolderPath: string | undefined,
  relativePath: string,
): string | null {
  if (!mediaFolderPath) {
    if (isAbsPath(relativePath)) {
      return Path.toPlatformPath(relativePath)
    }
    return null
  }
  const absolutePath = isAbsPath(relativePath)
    ? relativePath
    : join(mediaFolderPath, relativePath)
  return Path.toPlatformPath(absolutePath)
}

/**
 * Encapsulates the business logic for `MediaFileTable`:
 *  - open a file via the OS shell (`openFile` IPC / HTTP)
 *  - open the `MediaFilePropertyDialog` for a file
 *  - dispatch a row's double-click to the right file
 *
 * Kept UI-agnostic so it can be exercised without rendering `UIMediaFileTable`.
 */
export interface MediaFileTableController {
  /** Open a file path (relative to `mediaFolderPath`) in the OS default app. */
  openFile: (relativePath: string) => void
  /** Open the `MediaFilePropertyDialog` for a file path (relative to `mediaFolderPath`). */
  openPropertiesDialog: (relativePath: string) => void
  /**
   * Row double-click handler:
   *  - data row → opens `row.videoFile`
   *  - folder file row → opens `row.path`
   *  - otherwise (e.g. divider) → no-op
   */
  handleDoubleClick: (row: UIMediaFileDataRow | UIMediaFileFolderRow) => void
}

export function useMediaFileTableController(
  mediaFolderPath: string | undefined,
): MediaFileTableController {
  const [openMediaFileProperty] = useDialogs().mediaFilePropertyDialog

  const openFile = useCallback(
    (relativePath: string) => {
      const platformPath = resolveAbsolutePath(mediaFolderPath, relativePath)
      if (!platformPath) {
        console.warn(
          "[MediaFileTable] Cannot open file without mediaFolderPath:",
          relativePath,
        )
        return
      }
      openFileApi(platformPath).catch((error) => {
        console.error("[MediaFileTable] Failed to open file:", error)
      })
    },
    [mediaFolderPath],
  )

  const openPropertiesDialog = useCallback(
    (relativePath: string) => {
      const filePath = resolveAbsolutePath(mediaFolderPath, relativePath)
      if (!filePath) {
        console.warn(
          "[MediaFileTable] Cannot open properties without mediaFolderPath:",
          relativePath,
        )
        return
      }
      openMediaFileProperty({ filePath })
    },
    [mediaFolderPath, openMediaFileProperty],
  )

  const handleDoubleClick = useCallback(
    (row: UIMediaFileDataRow | UIMediaFileFolderRow) => {
      if (row.type === "episode" && row.videoFile) {
        openFile(row.videoFile)
        return
      }
      if (row.type === "folderFile" && row.path) {
        openFile(row.path)
      }
    },
    [openFile],
  )

  return { openFile, openPropertiesDialog, handleDoubleClick }
}
