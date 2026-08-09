import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore"
import { setWatchedFolder } from "@/api/setWatchedFolder"
import { useEffect } from "react"

/**
 * Keeps CLI FolderWatcher in sync with the primary sidebar selection.
 */
export function useSyncWatchedFolder() {
  const selectedFolder = useUIMediaFolderStore((s) => s.selectedFolder)

  useEffect(() => {
    const ac = new AbortController()
    const folderPath = selectedFolder?.trim() ? selectedFolder : null

    void (async () => {
      try {
        await setWatchedFolder(folderPath, ac.signal)
      } catch (error) {
        if (ac.signal.aborted) return
        console.error("[useSyncWatchedFolder] failed to sync watched folder", error)
      }
    })()

    return () => {
      ac.abort()
    }
  }, [selectedFolder])
}
