import { useState, useRef, useCallback, useEffect } from "react"
import { Sidebar } from "@/components/v2/Sidebar"
import { Toolbar } from "@/components/v2/Toolbar"
import type { ViewMode } from "@/components/v2/ViewSwitcher"
import { useMediaMetadataStoreState, useMediaMetadataStoreActions } from "@/stores/mediaMetadataStore"
import { useUIMediaFolderStore, useUIMediaFolderStoreState } from "@/stores/uiMediaFolderStore"
import { useDialogs } from "@/providers/dialog-provider"
import type { FileItem, FolderType } from "@/providers/dialog-provider"
import { Toaster } from "./components/ui/sonner"
import { toast } from "sonner"
import { mediaMetadataRepository } from "@/api/mediaMetadataRepository"
import { Assistant } from "./ai/Assistant"
import { StatusBar } from "./components/StatusBar"
import { AppWarningBanner } from "./components/AppWarningBanner"
import { Path } from "@core/path"
import Welcome from "./components/welcome"
import TvShowPanel from "./components/TvShowPanel"
import MoviePanel from "./components/MoviePanel"
import { LocalFilePanel } from "./components/LocalFilePanel"
import { nextTraceId } from "@/lib/utils"
import { useConfig } from "@/hooks/userConfig"
import { isNotNil } from "es-toolkit"
import {
  UI_MediaFolderImportedEvent,
  UI_MediaLibraryImportedEvent,
  type OnMediaFolderImportedEventData,
  type OnMediaLibraryImportedEventData,
} from "./types/eventTypes"
import { MusicPanel } from "./components/MusicPanel"
// WebSocketHandlers is now at AppSwitcher level to avoid disconnection on view switch

function AppV2Content() {
  // WebSocket connection is now established at AppSwitcher level to persist across view changes
  // No need to call useWebSocket() here anymore
  const { userConfig, setAndSaveUserConfig } = useConfig()

  const [sidebarWidth, setSidebarWidth] = useState(250) // 初始侧边栏宽度
  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const resizeRef = useRef<HTMLDivElement>(null)

  const { folders: uiFolders, selectedFolder } = useUIMediaFolderStoreState()

  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>("metadata")

  // Dialogs
  const { openFolderDialog, filePickerDialog } = useDialogs()
  const [openOpenFolder] = openFolderDialog
  const [openFilePicker] = filePickerDialog

  // Media metadata
  const { selectedMediaMetadata } = useMediaMetadataStoreState()
  const { setSelectedByMediaFolderPath, getMediaMetadata, removeMediaMetadatas, addMediaMetadatas } = useMediaMetadataStoreActions()

  // Check if running in Electron environment
  const isElectron = useCallback(() => {
    const hasWindow = typeof window !== 'undefined'
    const hasElectron = hasWindow && typeof (window as any).electron !== 'undefined'
    const electronValue = hasWindow ? (window as any).electron : undefined
    
    console.log('[isElectron] Debug:', {
      hasWindow,
      hasElectron,
      electronValue,
      windowKeys: hasWindow ? Object.keys(window).filter(key => key.includes('electron') || key.includes('Electron')) : [],
      electronKeys: electronValue ? Object.keys(electronValue) : [],
      result: hasWindow && hasElectron
    })
    
    return hasWindow && hasElectron
  }, [])

  /** Bridge: folder store selection drives legacy media metadata store (panels still use it). */
  useEffect(() => {
    if (selectedFolder) {
      setSelectedByMediaFolderPath(selectedFolder)
    }
  }, [selectedFolder, setSelectedByMediaFolderPath])

  /** When metadata loads with a selection but folder store is still empty, align store (e.g. restored index). */
  useEffect(() => {
    const path = selectedMediaMetadata?.mediaFolderPath
    if (!path) return
    const { selectedFolder: sf } = useUIMediaFolderStore.getState()
    if (!sf) {
      useUIMediaFolderStore.getState().applyFolderClick(path, false)
    }
  }, [selectedMediaMetadata?.mediaFolderPath])

  // Open native file dialog in Electron
  const openNativeFileDialog = useCallback(async (options?: { title?: string }): Promise<FileItem | null> => {
    const title = options?.title ?? 'Select Folder'
    console.log('[openNativeFileDialog] Function called')
    
    try {
      const hasWindow = typeof window !== 'undefined'
      console.log('[openNativeFileDialog] hasWindow:', hasWindow)
      
      if (!hasWindow) {
        console.log('[openNativeFileDialog] window is undefined, returning null')
        return null
      }
      
      const electron = (window as any).electron
      console.log('[openNativeFileDialog] electron object:', {
        exists: electron !== undefined,
        type: typeof electron,
        keys: electron ? Object.keys(electron) : [],
        electronValue: electron
      })
      
      if (!electron) {
        console.log('[openNativeFileDialog] electron is undefined, returning null')
        return null
      }
      
      console.log('[openNativeFileDialog] electron.dialog:', {
        exists: electron.dialog !== undefined,
        type: typeof electron.dialog,
        keys: electron.dialog ? Object.keys(electron.dialog) : [],
        dialogValue: electron.dialog
      })
      
      if (!electron.dialog) {
        console.log('[openNativeFileDialog] electron.dialog is undefined, returning null')
        return null
      }
      
      console.log('[openNativeFileDialog] electron.dialog.showOpenDialog:', {
        exists: electron.dialog.showOpenDialog !== undefined,
        type: typeof electron.dialog.showOpenDialog,
        isFunction: typeof electron.dialog.showOpenDialog === 'function'
      })
      
      if (!electron.dialog.showOpenDialog) {
        console.log('[openNativeFileDialog] electron.dialog.showOpenDialog is undefined, returning null')
        return null
      }
      
      console.log('[openNativeFileDialog] Calling electron.dialog.showOpenDialog with options:', {
        properties: ['openDirectory'],
        title
      })
      
      const result = await electron.dialog.showOpenDialog({
        properties: ['openDirectory'],
        title
      })
      
      console.log('[openNativeFileDialog] Dialog result:', {
        result,
        canceled: result.canceled,
        filePaths: result.filePaths,
        filePathsLength: result.filePaths?.length,
        filePathsType: typeof result.filePaths,
        resultKeys: Object.keys(result)
      })
      
      if (result.canceled) {
        console.log('[openNativeFileDialog] Dialog was canceled by user')
        return null
      }
      
      if (!result.filePaths) {
        console.log('[openNativeFileDialog] result.filePaths is undefined or null')
        return null
      }
      
      if (result.filePaths.length === 0) {
        console.log('[openNativeFileDialog] result.filePaths is empty array')
        return null
      }
      
      const path = result.filePaths[0]
      const name = path.split(/[/\\]/).pop() || path
      
      console.log('[openNativeFileDialog] Returning file item:', {
        name,
        path,
        isDirectory: true
      })
      
      return {
        name,
        path,
        isDirectory: true
      }
    } catch (error) {
      console.error('[openNativeFileDialog] Error caught:', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        errorType: error?.constructor?.name,
        errorKeys: error ? Object.keys(error) : []
      })
      return null
    }
  }, [isElectron])

  const handleOpenFolderMenuClick = useCallback(() => {
    if (isElectron()) {
      // First, open the native file dialog to get the folder path
      openNativeFileDialog().then((selectedFile) => {
        if (selectedFile) {
          console.log(`Selected folder: ${selectedFile.path}`)
          // Then open the folder type selection dialog with the selected folder path
          openOpenFolder((type: FolderType) => {
            console.log(`Selected folder type: ${type}`)
            const traceId = `AppV2:UserOpenFolder:` + nextTraceId()
            const data: OnMediaFolderImportedEventData = {
              type: type,
              folderPathInPlatformFormat: selectedFile.path,
              traceId: traceId,
            }

            document.dispatchEvent(new CustomEvent(UI_MediaFolderImportedEvent, { detail: data }))
          }, selectedFile.path)
        }
      })
    } else {
      openFilePicker((file: FileItem) => {
        console.log(`Selected folder: ${file.path}`)
        openOpenFolder((type: FolderType) => {
          console.log(`Selected folder type: ${type}`)
          const traceId = `AppV2:UserOpenFolder:` + nextTraceId()
          const data: OnMediaFolderImportedEventData = {
            type: type,
            folderPathInPlatformFormat: file.path,
            traceId: traceId,
          }

          document.dispatchEvent(new CustomEvent(UI_MediaFolderImportedEvent, { detail: data }))
        }, file.path)
      }, {
        title: "Select Folder",
        description: "Choose a folder to open",
        selectFolder: true
      })
    }
  }, [isElectron, openOpenFolder, openNativeFileDialog, openFilePicker])

  const handleOpenMediaLibraryMenuClick = useCallback(() => {
    if (isElectron()) {
      openNativeFileDialog({ title: 'Select Media Library' }).then((selectedFile) => {
        if (selectedFile) {
          openOpenFolder((type: FolderType) => {
            const detail: OnMediaLibraryImportedEventData = {
              libraryPathInPlatformFormat: selectedFile.path,
              type,
              traceId: `AppV2:UserOpenMediaLibrary:${nextTraceId()}`,
            }
            document.dispatchEvent(new CustomEvent(UI_MediaLibraryImportedEvent, { detail }))
          }, selectedFile.path)
        }
      })
    } else {
      openFilePicker((file: FileItem) => {
        openOpenFolder((type: FolderType) => {
          const detail: OnMediaLibraryImportedEventData = {
            libraryPathInPlatformFormat: file.path,
            type,
            traceId: `AppV2:UserOpenMediaLibrary:${nextTraceId()}`,
          }
            document.dispatchEvent(new CustomEvent(UI_MediaLibraryImportedEvent, { detail }))
        }, file.path)
      }, {
        title: "Select Media Library",
        description: "Choose a folder containing multiple media folders",
        selectFolder: true
      })
    }
  }, [isElectron, openOpenFolder, openNativeFileDialog, openFilePicker])

  const onDeleteSelected = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0) return

      const traceId = `AppV2-onDeleteSelected-${nextTraceId()}`
      const deletedSet = new Set(paths)

      // Snapshot for rollback
      const removedMetadata = paths
        .map((p) => getMediaMetadata(p))
        .filter((m): m is NonNullable<typeof m> => m != null)
      const previousFolders = userConfig.folders
      const prevUiSelection = {
        selectedFolder: useUIMediaFolderStore.getState().selectedFolder,
        selectedFolders: [...useUIMediaFolderStore.getState().selectedFolders],
      }

      // 1. Optimistic: remove all selected from UI state at once
      removeMediaMetadatas(paths)
      const newFolders = userConfig.folders
        .filter((f) => isNotNil(f))
        .filter((folder) => !deletedSet.has(Path.posix(folder)))
      const newFolderPosix = newFolders.map((f) => Path.posix(f))
      setAndSaveUserConfig(traceId, { ...userConfig, folders: newFolders })

      const posixDeleted = paths.map((p) => Path.posix(p))
      const delSet = new Set(posixDeleted)
      const st = useUIMediaFolderStore.getState()
      const nextSelectedFolders = st.selectedFolders.filter((p) => !delSet.has(p))
      let nextPrimary = st.selectedFolder
      if (delSet.has(nextPrimary)) {
        nextPrimary = newFolderPosix[0] ?? ""
      }
      useUIMediaFolderStore.setState({
        selectedFolders:
          nextSelectedFolders.length > 0
            ? nextSelectedFolders
            : nextPrimary
              ? [nextPrimary]
              : [],
        selectedFolder: nextPrimary,
      })

      // 2. Async delete; rollback on failure
      try {
        await Promise.all(paths.map((path) => mediaMetadataRepository.delete(path, { traceId })))
      } catch (error) {
        console.error("[onDeleteSelected] Failed to delete some media metadata:", error)
        addMediaMetadatas(removedMetadata)
        setAndSaveUserConfig(traceId, { ...userConfig, folders: previousFolders })
        useUIMediaFolderStore.setState({
          selectedFolder: prevUiSelection.selectedFolder,
          selectedFolders: prevUiSelection.selectedFolders,
        })
        toast.error(
          error instanceof Error ? error.message : "Failed to delete selected folders. Changes reverted."
        )
      }
    },
    [
      userConfig,
      setAndSaveUserConfig,
      getMediaMetadata,
      removeMediaMetadatas,
      addMediaMetadatas,
    ]
  )

  // 最小和最大侧边栏宽度
  const MIN_SIDEBAR_WIDTH = 150
  const MAX_SIDEBAR_WIDTH = 500

  // 开始拖拽调整大小
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  // 处理触摸开始（移动设备）
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  // 拖拽调整大小
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return

      const newWidth = e.clientX
      if (newWidth >= MIN_SIDEBAR_WIDTH && newWidth <= MAX_SIDEBAR_WIDTH) {
        setSidebarWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    // 处理触摸移动（移动设备）
    const handleTouchMove = (e: TouchEvent) => {
      if (!isResizing) return

      const touch = e.touches[0]
      if (touch) {
        const newWidth = touch.clientX
        if (newWidth >= MIN_SIDEBAR_WIDTH && newWidth <= MAX_SIDEBAR_WIDTH) {
          setSidebarWidth(newWidth)
        }
      }
    }

    const handleTouchEnd = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      document.addEventListener("touchmove", handleTouchMove, { passive: false })
      document.addEventListener("touchend", handleTouchEnd)
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.removeEventListener("touchmove", handleTouchMove)
      document.removeEventListener("touchend", handleTouchEnd)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
  }, [isResizing])

  return (
    <div className="h-screen w-screen overflow-hidden">
      <div
        className="grid-container"
        style={{
          display: "grid",
          gridTemplateAreas: `
            "warning warning"
            "toolbar toolbar"
            "sidebar content"
            "statusbar statusbar"
          `,
          gridTemplateRows: "auto auto 1fr auto",
          gridTemplateColumns: `${sidebarWidth}px 1fr`,
          height: "100vh",
          width: "100vw",
        }}
      >
        {/* Warning Banner */}
        <div style={{ gridArea: "warning" }}>
          <AppWarningBanner />
        </div>

        {/* 工具栏 */}
        <div
          className="flex items-center gap-1.5 border-b border-border bg-muted/50 px-3 py-1.5 shadow-sm"
          style={{ gridArea: "toolbar" }}
        >
          <Toolbar 
            onOpenFolderMenuClick={handleOpenFolderMenuClick}
            onOpenMediaLibraryMenuClick={handleOpenMediaLibraryMenuClick}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            viewSwitcherDisabled={uiFolders.length === 0 || !selectedMediaMetadata}
          />
        </div>

        {/* 侧边栏 */}
        <div
          ref={sidebarRef}
          className="relative min-w-0 overflow-hidden border-r border-border bg-muted/30"
          style={{ gridArea: "sidebar" }}
        >
          <Sidebar onDeleteSelected={onDeleteSelected} />

          {/* 拖拽调整大小的手柄 */}
          <div
            ref={resizeRef}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            className={`absolute top-0 -right-0.5 z-10 h-full w-2 cursor-col-resize touch-none transition-colors ${
              isResizing ? "bg-primary" : "bg-transparent hover:bg-muted-foreground/30"
            }`}
          />
        </div>

        {/* 内容区 */}
        <div
          className="flex flex-col overflow-hidden bg-background"
          style={{ gridArea: "content" }}
        >
          {uiFolders.length === 0 && (
            <div style={{ padding: "20px", overflow: "auto" }}>
              <Welcome />
            </div>
          )}
          {uiFolders.length > 0 && selectedMediaMetadata && (
            <>
              {viewMode === "metadata" && (
                <>

                  {selectedMediaMetadata.type === "tvshow-folder" && (
                    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                      <TvShowPanel />
                    </div>
                  )}
                  {selectedMediaMetadata.type === "movie-folder" && (
                    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                      <MoviePanel />
                    </div>
                  )}
                  {selectedMediaMetadata.type === "music-folder" && (
                    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                      <MusicPanel />
                    </div>
                  )}

                  {selectedMediaMetadata.type !== "tvshow-folder" 
                  && selectedMediaMetadata.type !== "movie-folder"
                  && selectedMediaMetadata.type !== "music-folder" && (
                    <LocalFilePanel mediaFolderPath={selectedMediaMetadata.mediaFolderPath} />
                  )}
                </>
              )}
              {viewMode === "files" && (
                <LocalFilePanel mediaFolderPath={selectedMediaMetadata.mediaFolderPath} />
              )}
            </>
          )}
        </div>

        {/* 状态栏 */}
        <div
          style={{
            gridArea: "statusbar",
          }}
        >
          <StatusBar />
        </div>
      </div>

      {/* 全局拖拽时的遮罩层样式 */}
      {isResizing && (
        <style>{`
          * {
            cursor: col-resize !important;
            user-select: none !important;
          }
        `}</style>
      )}

      <Assistant />
      {/* WebSocketHandlers is now at AppSwitcher level to avoid disconnection on view switch */}
      <Toaster position="bottom-right" />
    </div>
  )
}

export default function AppV2() {
  return (
      <AppV2Content />
  )
}

