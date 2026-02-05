import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { Sidebar, type SortOrder, type FilterType } from "@/components/v2/Sidebar"
import { Toolbar } from "@/components/v2/Toolbar"
import type { ViewMode } from "@/components/v2/ViewSwitcher"
import { useMediaMetadata } from "@/providers/media-metadata-provider"
import { useDialogs } from "@/providers/dialog-provider"
import { basename } from "@/lib/path"
import type { MediaFolderListItemProps } from "@/components/sidebar/MediaFolderListItem"
import type { FileItem, FolderType } from "@/providers/dialog-provider"
import { Toaster } from "./components/ui/sonner"
import { Assistant } from "./ai/Assistant"
import { StatusBar } from "./components/StatusBar"
import { BackgroundJobsProvider, useBackgroundJobs } from "./components/background-jobs/BackgroundJobsProvider"
import type { JobStatus } from "@/types/background-jobs"
import { Path } from "@core/path"
import Welcome from "./components/welcome"
import TvShowPanel from "./components/TvShowPanel"
import MoviePanel from "./components/MoviePanel"
import { LocalFilePanel } from "./components/LocalFilePanel"
import { nextTraceId } from "@/lib/utils"
import { useConfig } from "./providers/config-provider"
import { listFiles } from "@/api/listFiles"
import { isNotNil } from "es-toolkit"
import { UI_MediaFolderImportedEvent, type OnMediaFolderImportedEventData } from "./types/eventTypes"

// WebSocketHandlers is now at AppSwitcher level to avoid disconnection on view switch

function AppV2Content() {
  // WebSocket connection is now established at AppSwitcher level to persist across view changes
  // No need to call useWebSocket() here anymore
  const { userConfig, setAndSaveUserConfig } = useConfig()

  const [sidebarWidth, setSidebarWidth] = useState(250) // 初始侧边栏宽度
  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const resizeRef = useRef<HTMLDivElement>(null)

  // Sidebar state
  const [sortOrder, setSortOrder] = useState<SortOrder>("alphabetical")
  const [filterType, setFilterType] = useState<FilterType>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")
  // Multi-select: set of selected folder paths and the primary (drives content panel)
  const [selectedFolderPaths, setSelectedFolderPaths] = useState<Set<string>>(new Set())
  const [primaryFolderPath, setPrimaryFolderPath] = useState<string | undefined>(undefined)
  const hasInitializedSelectionFromProvider = useRef(false)

  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>("metadata")

  // Dialogs
  const { openFolderDialog, filePickerDialog } = useDialogs()
  const [openOpenFolder] = openFolderDialog
  const [openFilePicker] = filePickerDialog

  // Media metadata
  const { mediaMetadatas, setSelectedMediaMetadata, selectedMediaMetadata, removeMediaMetadata } = useMediaMetadata()

  // Background jobs (optional - for "Importing Media Library" progress)
  const backgroundJobs = useBackgroundJobs()

  // Status bar message
  const statusBarMessage = useMemo(() => {
    if(selectedMediaMetadata === undefined || selectedMediaMetadata.mediaFolderPath === undefined) {
      return ''
    }
    return `${Path.toPlatformPath(selectedMediaMetadata.mediaFolderPath)}`
  }, [selectedMediaMetadata])

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

  // Sync primary folder to content panel (selectedMediaMetadata)
  useEffect(() => {
    if (primaryFolderPath === undefined || mediaMetadatas.length === 0) return
    const index = mediaMetadatas.findIndex((m) => m.mediaFolderPath === primaryFolderPath)
    if (index !== -1) setSelectedMediaMetadata(index)
  }, [primaryFolderPath, mediaMetadatas, setSelectedMediaMetadata])

  // Initialize selection from provider once (e.g. after load or restore)
  useEffect(() => {
    if (
      selectedMediaMetadata?.mediaFolderPath &&
      !hasInitializedSelectionFromProvider.current
    ) {
      const path = selectedMediaMetadata.mediaFolderPath
      setPrimaryFolderPath(path)
      setSelectedFolderPaths(new Set([path]))
      hasInitializedSelectionFromProvider.current = true
    }
  }, [selectedMediaMetadata?.mediaFolderPath])

  useEffect(() => {
    if(selectedMediaMetadata === undefined) {
      return;
    }

    if(selectedMediaMetadata.mediaFolderPath === undefined) {
      console.error('[AppV2] selectedMediaMetadata.mediaFolderPath is undefined')
      return;
    }

    if(selectedMediaMetadata.status !== 'ok') {
      return;
    }

  }, [selectedMediaMetadata])

  // Open native file dialog in Electron
  const openNativeFileDialog = useCallback(async (): Promise<FileItem | null> => {
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
        title: 'Select Folder'
      })
      
      const result = await electron.dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select Folder'
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
    const runImportInBackground = async (
      jobId: string | null,
      libraryPath: string,
      type: FolderType
    ) => {
      const updateJob = backgroundJobs?.updateJob
      const report = (updates: Partial<{ status: JobStatus; progress: number }>) => {
        if (jobId && updateJob) updateJob(jobId, updates)
      }
      try {
        const listFilesResponse = await listFiles({
          path: libraryPath,
          onlyFolders: true,
          includeHiddenFiles: false,
        })

        if (listFilesResponse.error || !listFilesResponse.data) {
          console.error(`[AppV2] Failed to list folders in media library: ${listFilesResponse.error}`)
          report({ status: 'failed' })
          return
        }

        const subfolders = listFilesResponse.data.items.filter(
          (item) => item.isDirectory && item.path
        )
        const total = subfolders.length
        console.log(`[AppV2] Found ${total} subfolders in media library`)

        if (total === 0) {
           report({ progress: 100, status: 'succeeded' })
          return
        }

        let completed = 0
        for (const subfolder of subfolders) {
          if (!subfolder.path) continue
          try {
            const traceId = `AppV2:UserOpenMediaLibrary:${nextTraceId()}`
            const data: OnMediaFolderImportedEventData = {
              type: type,
              folderPathInPlatformFormat: subfolder.path,
              traceId: traceId,
            }
            document.dispatchEvent(new CustomEvent(UI_MediaFolderImportedEvent, { detail: data }))
          } catch (error) {
            console.error(`[AppV2] Failed to import folder ${subfolder.path}:`, error)
            // Continue with next folder
          }
          completed += 1
          report({ progress: (completed / total) * 100 })
        }

         report({ progress: 100, status: 'succeeded' })
        console.log(`[AppV2] Finished importing ${total} folders from media library`)
      } catch (error) {
        console.error(`[AppV2] Import media library failed:`, error)
         report({ status: 'failed' })
      }
    }

    const startImportWithJob = (libraryPath: string, type: FolderType) => {
      if (!backgroundJobs) {
        runImportInBackground(null, libraryPath, type)
        return
      }
      const jobId = backgroundJobs.addJob('Importing Media Library')
       backgroundJobs.updateJob(jobId, { status: 'running' })
      runImportInBackground(jobId, libraryPath, type)
    }

    if (isElectron()) {
      openNativeFileDialog().then((selectedFile) => {
        if (selectedFile) {
          console.log(`[AppV2] Selected media library: ${selectedFile.path}`)
          openOpenFolder((type: FolderType) => {
            console.log(`[AppV2] Selected media library type: ${type} for library: ${selectedFile.path}`)
            startImportWithJob(selectedFile.path, type)
          }, selectedFile.path)
        }
      })
    } else {
      openFilePicker((file: FileItem) => {
        console.log(`[AppV2] Selected media library: ${file.path}`)
        openOpenFolder((type: FolderType) => {
          console.log(`[AppV2] Selected media library type: ${type} for library: ${file.path}`)
          startImportWithJob(file.path, type)
        }, file.path)
      }, {
        title: "Select Media Library",
        description: "Choose a folder containing multiple media folders",
        selectFolder: true
      })
    }
  }, [isElectron, openOpenFolder, openNativeFileDialog, openFilePicker, backgroundJobs])

  // Convert mediaMetadatas to folders
  const folders: MediaFolderListItemProps[] = useMemo(() => {
    return mediaMetadatas.map((metadata) => {
      console.log(`[AppV2] mediaMetadatas: `, metadata)
      return {
        mediaName: metadata.tmdbTvShow?.name ?? (basename(metadata.mediaFolderPath!) ?? '未识别媒体名称'),
        path: metadata.mediaFolderPath,
        mediaType: metadata.type === "tvshow-folder" ? "tvshow" : metadata.type === "movie-folder" ? "movie" : "tvshow-folder",
        status: metadata.status,
      } as MediaFolderListItemProps
    })
  }, [mediaMetadatas])

  // Filter and sort folders
  const filteredAndSortedFolders = useMemo(() => {
    let result = [...folders]

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter((folder) => {
        const mediaNameMatch = folder.mediaName.toLowerCase().includes(query)
        const pathMatch = folder.path.toLowerCase().includes(query)
        const folderName = basename(folder.path) || ""
        const folderNameMatch = folderName.toLowerCase().includes(query)
        return mediaNameMatch || pathMatch || folderNameMatch
      })
    }

    // Filter by type
    if (filterType !== "all") {
      result = result.filter((folder) => folder.mediaType === filterType)
    }

    // Sort by alphabetical order
    result.sort((a, b) => {
      const comparison = a.mediaName.localeCompare(b.mediaName, undefined, { sensitivity: 'base' })
      return sortOrder === "alphabetical" ? comparison : -comparison
    })

    return result
  }, [folders, sortOrder, filterType, searchQuery])

  const onFolderClick = useCallback(
    (path: string, modifiers: { ctrlKey: boolean; metaKey: boolean }) => {
      const multi = modifiers.ctrlKey || modifiers.metaKey
      if (multi) {
        setSelectedFolderPaths((prev) => {
          const next = new Set(prev)
          if (next.has(path)) next.delete(path)
          else next.add(path)
          return next
        })
        setPrimaryFolderPath(path)
      } else {
        setSelectedFolderPaths(new Set([path]))
        setPrimaryFolderPath(path)
      }
    },
    []
  )

  const onSelectAll = useCallback(() => {
    setSelectedFolderPaths(
      new Set(filteredAndSortedFolders.map((f) => f.path))
    )
    if (filteredAndSortedFolders.length > 0) {
      setPrimaryFolderPath(filteredAndSortedFolders[0].path)
    }
  }, [filteredAndSortedFolders])

  const onDeleteSelected = useCallback(
    (paths: string[]) => {
      if (paths.length === 0) return
      paths.forEach((path) => removeMediaMetadata(path))
      const traceId = `AppV2-onDeleteSelected-${nextTraceId()}`
      const deletedSet = new Set(paths)
      const newFolders = userConfig.folders
        .filter(f => isNotNil(f))
        .filter(
          (folder) => !deletedSet.has(Path.posix(folder))
        )
      setAndSaveUserConfig(traceId, { ...userConfig, folders: newFolders })
      setSelectedFolderPaths((prev) => {
        const next = new Set(prev)
        paths.forEach((p) => next.delete(p))
        return next
      })
      if (primaryFolderPath && deletedSet.has(primaryFolderPath)) {
        const remaining = new Set(userConfig.folders)
        paths.forEach((p) => remaining.delete(p))
        const firstRemaining = remaining.size > 0 ? [...remaining][0] : undefined
        setPrimaryFolderPath(firstRemaining)
      }
    },
    [userConfig, setAndSaveUserConfig, removeMediaMetadata, primaryFolderPath]
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
            "toolbar toolbar"
            "sidebar content"
            "statusbar statusbar"
          `,
          gridTemplateRows: "auto 1fr auto",
          gridTemplateColumns: `${sidebarWidth}px 1fr`,
          height: "100vh",
          width: "100vw",
        }}
      >
        {/* 工具栏 */}
        <div
          style={{
            gridArea: "toolbar",
            backgroundColor: "#f8f8f8",
            borderBottom: "1px solid #d0d0d0",
            padding: "6px 12px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          <Toolbar 
            onOpenFolderMenuClick={handleOpenFolderMenuClick}
            onOpenMediaLibraryMenuClick={handleOpenMediaLibraryMenuClick}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            viewSwitcherDisabled={folders.length === 0 || !selectedMediaMetadata}
          />
        </div>

        {/* 侧边栏 */}
        <div
          ref={sidebarRef}
          style={{
            gridArea: "sidebar",
            backgroundColor: "#f5f5f5",
            borderRight: "1px solid #d0d0d0",
            position: "relative",
            overflow: "hidden",
            minWidth: 0,
          }}
        >
          <Sidebar
            sortOrder={sortOrder}
            onSortOrderChange={setSortOrder}
            filterType={filterType}
            onFilterTypeChange={setFilterType}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            filteredAndSortedFolders={filteredAndSortedFolders}
            selectedFolderPaths={selectedFolderPaths}
            primaryFolderPath={primaryFolderPath}
            onFolderClick={onFolderClick}
            onSelectAll={onSelectAll}
            onDeleteSelected={onDeleteSelected}
          />

          {/* 拖拽调整大小的手柄 */}
          <div
            ref={resizeRef}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            style={{
              position: "absolute",
              top: 0,
              right: "-2px",
              width: "8px",
              height: "100%",
              cursor: "col-resize",
              backgroundColor: isResizing ? "#4a9eff" : "transparent",
              transition: "background-color 0.15s",
              zIndex: 10,
              touchAction: "none",
            }}
            onMouseEnter={(e) => {
              if (!isResizing) {
                e.currentTarget.style.backgroundColor = "#b0b0b0"
              }
            }}
            onMouseLeave={(e) => {
              if (!isResizing) {
                e.currentTarget.style.backgroundColor = "transparent"
              }
            }}
          />
        </div>

        {/* 内容区 */}
        <div
          style={{
            gridArea: "content",
            backgroundColor: "#ffffff",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {folders.length === 0 && (
            <div style={{ padding: "20px", overflow: "auto" }}>
              <Welcome />
            </div>
          )}
          {folders.length > 0 && selectedMediaMetadata && (
            <>
              {console.log(`[DEBUG] selectedMediaMetadata: `, selectedMediaMetadata)}
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
                  {selectedMediaMetadata.type !== "tvshow-folder" && selectedMediaMetadata.type !== "movie-folder" && (
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
          <StatusBar message={statusBarMessage} />
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

