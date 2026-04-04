import { dirname, join } from "@/lib/path"
import { nextTraceId } from "@/lib/utils"
import type { RenameFolderParams } from "@/api/renameFolder"
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"

/** Dependencies for doRenameFolder; all passed as params to keep it decoupled from the component. */
export interface DoRenameFolderDeps {
  renameFolderApi: (params: RenameFolderParams) => Promise<unknown>
  deleteMediaMetadata: (path: string, options?: { traceId?: string }) => Promise<void>
  updateMediaMetadata: (
    path: string,
    metadata: UIMediaMetadata | ((current: UIMediaMetadata) => UIMediaMetadata),
    options?: { traceId?: string }
  ) => void | Promise<void>
  refreshMediaMetadata: (path: string) => void | Promise<void>
}

/**
 * Performs folder rename: calls API, updates metadata, and refreshes.
 * Decoupled from UI; all dependencies are passed in via deps.
 */
export async function doRenameFolder(
  path: string,
  newName: string,
  currentMetadata: UIMediaMetadata,
  deps: DoRenameFolderDeps,
  traceId?: string
): Promise<void> {
  const id = traceId ?? `doRenameFolder-${nextTraceId()}`
  console.log(`[${id}] Renaming folder ${path} to ${newName}`)

  try {
    const parentDir = dirname(path)
    const newFolderPath = join(parentDir, newName)

    await deps.renameFolderApi({ from: path, to: newFolderPath })

    const updatedMetadata: UIMediaMetadata = {
      ...currentMetadata,
      mediaFolderPath: newFolderPath,
    }
    if (updatedMetadata.tvShow) {
      updatedMetadata.tvShow = {
        ...updatedMetadata.tvShow,
        name: newName,
      }
    } else if (updatedMetadata.movie) {
      updatedMetadata.movie = {
        ...updatedMetadata.movie,
        name: newName,
      }
    } else {
      updatedMetadata.mediaName = newName
    }

    if (path !== newFolderPath) {
      await deps.deleteMediaMetadata(path, { traceId: id })
    }

    await deps.updateMediaMetadata(newFolderPath, updatedMetadata, { traceId: id })
    await deps.refreshMediaMetadata(newFolderPath)

    console.log("Folder renamed successfully:", path, "->", newFolderPath)
  } catch (error) {
    console.error("Failed to rename folder:", error)
    throw error
  }
}
