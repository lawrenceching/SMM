import { type ReactNode, useState, useRef, useCallback } from "react"
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore"
import { useDialogs } from "@/providers/dialog-provider"
import type { FolderType } from "@/providers/dialog-provider"
import { toast } from "sonner"
import { FolderOpen, Upload } from "lucide-react"

import {
  UI_MediaFolderImportedEvent,
  type OnMediaFolderImportedEventData,
} from "@/types/eventTypes"
import { nextTraceId } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isElectron(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as any).electron !== "undefined"
  )
}

/**
 * Retrieve the real filesystem path from a dropped `File` object.
 * Returns `null` when running outside Electron or when the path cannot
 * be determined.
 */
function getDroppedFolderPath(file: File): string | null {
  const api = (window as any).api
  if (api?.getPathForFile) {
    const path = api.getPathForFile(file)
    if (path) return path
  }

  // Fallback: some Electron versions expose `path` directly on the File
  if ((file as any).path) {
    return (file as any).path as string
  }

  return null
}

// ---------------------------------------------------------------------------
// DragDropReceiver
// ---------------------------------------------------------------------------

/**
 * A self-contained wrapper component that enables drag-and-drop folder import
 * in the Electron desktop application.
 *
 * - **Electron only**: in a browser environment it renders `children` without
 *   attaching any event handlers.
 * - **Visual overlay**: when a folder is dragged over the window a dark
 *   semi-transparent overlay with an icon is shown.
 * - **Duplicate detection**: if the dropped folder is already in the media
 *   library it is selected and a toast notification is displayed.
 * - **Import flow**: otherwise the `OpenFolderDialog` is opened to let the
 *   user choose the folder type (TV show / Movie / Music); after selection
 *   a `UI_MediaFolderImportedEvent` is dispatched which triggers the
 *   existing import pipeline (`MediaFolderImportedEventHandler`).
 */
export function DragDropReceiver({ children }: { children: ReactNode }) {
  const [isDragOver, setIsDragOver] = useState(false)
  const dragDepthRef = useRef(0)

  const folders = useUIMediaFolderStore((s) => s.folders)
  const setSelectedFolder = useUIMediaFolderStore((s) => s.setSelectedFolder)
  const [openOpenFolder] = useDialogs().openFolderDialog

  // ---- Event handlers ---------------------------------------------------

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!isElectron()) return
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes("Files")) {
      e.dataTransfer.dropEffect = "copy"
    }
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!isElectron()) return
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes("Files")) {
      dragDepthRef.current++
      if (dragDepthRef.current === 1) {
        setIsDragOver(true)
      }
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!isElectron()) return
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes("Files")) {
      dragDepthRef.current--
      if (dragDepthRef.current <= 0) {
        dragDepthRef.current = 0
        setIsDragOver(false)
      }
    }
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      if (!isElectron()) return
      e.preventDefault()
      e.stopPropagation()

      setIsDragOver(false)
      dragDepthRef.current = 0

      // Extract the first dropped item
      const files = Array.from(e.dataTransfer.files)
      if (files.length === 0) return

      const firstFile = files[0]
      const folderPath = getDroppedFolderPath(firstFile)
      if (!folderPath) {
        console.warn(
          "[DragDropReceiver] Could not determine folder path for dropped item",
          firstFile,
        )
        return
      }

      // -- Duplicate check ------------------------------------------------
      const existing = folders.find((f) => f.path === folderPath)
      if (existing) {
        setSelectedFolder(folderPath)
        toast.info("Folder already imported")
        return
      }

      // -- Open folder-type dialog then dispatch import event ------------
      openOpenFolder((type: FolderType) => {
        const traceId = `DragDropReceiver:${nextTraceId()}`
        const data: OnMediaFolderImportedEventData = {
          type,
          folderPathInPlatformFormat: folderPath,
          traceId,
        }
        document.dispatchEvent(
          new CustomEvent(UI_MediaFolderImportedEvent, { detail: data }),
        )
      }, folderPath)
    },
    [folders, setSelectedFolder, openOpenFolder],
  )

  // ---- Non-Electron: no-op ---------------------------------------------
  if (!isElectron()) {
    return <>{children}</>
  }

  // ---- Electron: event wrapper + overlay --------------------------------
  return (
    <div
      className="relative h-screen w-screen"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}

      {/* Drag-over overlay */}
      {isDragOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md transition-opacity duration-200">
          <div className="flex flex-col items-center justify-center gap-6 rounded-2xl border-4 border-dashed border-primary bg-primary/10 p-16 shadow-2xl transition-all duration-300">
            <div className="relative">
              <div className="absolute inset-0 animate-pulse rounded-full bg-primary/20 blur-xl" />
              <FolderOpen className="relative z-10 h-20 w-20 animate-bounce text-primary" />
              <Upload className="absolute -right-3 -top-3 z-10 h-10 w-10 rounded-full border-4 border-primary bg-background p-2 text-primary shadow-lg" />
            </div>
            <div className="space-y-3 text-center">
              <h3 className="text-3xl font-bold text-foreground">
                Drop Folder Here
              </h3>
              <p className="max-w-md text-base text-muted-foreground">
                Release the folder to add it to your media library and select
                its type
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              <span>Ready to receive folder</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
