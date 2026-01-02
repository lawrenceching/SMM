import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { Sidebar, type SortOrder, type FilterType } from "@/components/v2/Sidebar"
import { Toolbar } from "@/components/v2/Toolbar"
import { useMediaMetadata } from "@/components/media-metadata-provider"
import { useDialogs } from "@/components/dialog-provider"
import { useConfig } from "@/components/config-provider"
import { basename } from "@/lib/path"
import type { MediaFolderListItemProps } from "@/components/sidebar/MediaFolderListItem"
import type { FileItem, FolderType } from "@/components/dialog-provider"
import { readMediaMetadataApi } from "@/api/readMediaMatadata"
import { useWebSocket, useWebSocketEvent, sendAcknowledgement } from "./hooks/useWebSocket"
import { Toaster } from "./components/ui/sonner"
import { Assistant } from "./ai/Assistant"
import { Button } from "@/components/ui/button"
import { StatusBar } from "./components/StatusBar"
import { Path } from "@core/path"
import Welcome from "./components/welcome"
import TvShowPanel from "./components/TvShowPanel"
import { LocalFilePanel } from "./components/LocalFilePanel"

// WebSocketHandlers component
function WebSocketHandlers() {
  const { reload: reloadUserConfig } = useConfig();
  const { refreshMediaMetadata, selectedMediaMetadata } = useMediaMetadata();
  const { confirmationDialog } = useDialogs();
  const [openConfirmation, closeConfirmation] = confirmationDialog;

  useWebSocketEvent((message) => {
    // Handle getSelectedMediaMetadata event with Socket.IO acknowledgement
    if (message.event === "getSelectedMediaMetadata") {
      console.log('[WebSocketHandlers][DEBUG] getSelectedMediaMetadata received', {
        message,
        hasCallback: !!(message as any)._socketCallback,
        selectedMediaMetadata
      });
      
      // Send acknowledgement with selected media metadata
      sendAcknowledgement(message, {
        selectedMediaMetadata: selectedMediaMetadata || null,
      });
      console.log('[WebSocketHandlers][DEBUG] getSelectedMediaMetadata acknowledgement sent');
    }
    
    // Handle mediaMetadataUpdated event (no acknowledgement needed)
    if (message.event === "mediaMetadataUpdated") {
      const folderPath = message.data?.folderPath;
      if (folderPath) {
        console.log(`[WebSocketHandlers] Received mediaMetadataUpdated event for folder: ${folderPath}`);
        refreshMediaMetadata(folderPath);
      } else {
        console.warn(`[WebSocketHandlers] mediaMetadataUpdated event missing folderPath in data:`, message.data);
        reloadUserConfig();
      }
    }

    // Handle askForConfirmation event with Socket.IO acknowledgement
    if (message.event === "askForConfirmation") {
      console.log('[WebSocketHandlers][DEBUG] askForConfirmation received', {
        message,
        hasCallback: !!(message as any)._socketCallback,
        data: message.data
      });
      
      // Support both data formats:
      // 1. message field (from server tool)
      // 2. title and body fields (from debug API)
      const confirmationMessage = message.data?.body || message.data?.message;
      const dialogTitle = message.data?.title || "Confirmation";
      
      if (!confirmationMessage) {
        console.warn(`[WebSocketHandlers] askForConfirmation event missing message/body:`, message.data);
        // Send error acknowledgement
        sendAcknowledgement(message, { confirmed: false, error: 'Missing message' });
        return;
      }
      
      console.log(`[WebSocketHandlers] Received askForConfirmation event: ${confirmationMessage}`);
      
      // Handler to send acknowledgement and close dialog
      const sendResponse = (confirmed: boolean) => {
        console.log(`[WebSocketHandlers][DEBUG] sendResponse called with confirmed=${confirmed}`);
        
        // Send acknowledgement back via Socket.IO callback
        const ackData = {
          confirmed: confirmed,
          response: confirmed ? "yes" : "no",
        };
        console.log(`[WebSocketHandlers][DEBUG] About to call sendAcknowledgement with:`, ackData);
        sendAcknowledgement(message, ackData);
        console.log(`[WebSocketHandlers][DEBUG] sendAcknowledgement returned`);
        closeConfirmation();
      };
      
      // Open confirmation dialog with Yes/No buttons
      openConfirmation({
        title: dialogTitle,
        description: confirmationMessage,
        showCloseButton: false,
        onClose: () => {
          // If dialog is closed without clicking Yes/No, default to "no"
          sendResponse(false);
        },
        content: (
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => sendResponse(false)}
            >
              No
            </Button>
            <Button
              onClick={() => sendResponse(true)}
            >
              Yes
            </Button>
          </div>
        ),
      });
    } else if(message.event === "userConfigUpdated") {
      console.log('[WebSocketHandlers][DEBUG] userConfigUpdated received');
      reloadUserConfig();      
    }
  });

  return (
    <></>
  )
}

export default function AppV2() {
  // Establish WebSocket connection when app loads
  useWebSocket();

  const [sidebarWidth, setSidebarWidth] = useState(250) // 初始侧边栏宽度
  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const resizeRef = useRef<HTMLDivElement>(null)

  // Sidebar state
  const [sortOrder, setSortOrder] = useState<SortOrder>("alphabetical")
  const [filterType, setFilterType] = useState<FilterType>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")

  // Dialogs
  const { openFolderDialog, filePickerDialog } = useDialogs()
  const [openOpenFolder] = openFolderDialog
  const [openFilePicker] = filePickerDialog

  // Media metadata
  const { mediaMetadatas, setSelectedMediaMetadata, addMediaMetadata, selectedMediaMetadata } = useMediaMetadata()

  // Status bar message
  const statusBarMessage = useMemo(() => {
    if(selectedMediaMetadata === undefined || selectedMediaMetadata.mediaFolderPath === undefined) {
      return ''
    }
    return `${Path.toPlatformPath(selectedMediaMetadata.mediaFolderPath)}`
  }, [selectedMediaMetadata])

  // Check if running in Electron environment
  const isElectron = useCallback(() => {
    return typeof window !== 'undefined' && typeof (window as any).electron !== 'undefined'
  }, [])

  // Open native file dialog in Electron
  const openNativeFileDialog = useCallback(async (): Promise<FileItem | null> => {
    if (!isElectron()) {
      return null
    }

    try {
      const electron = (window as any).electron
      if (electron?.dialog?.showOpenDialog) {
        const result = await electron.dialog.showOpenDialog({
          properties: ['openDirectory'],
          title: 'Select Folder'
        })
        
        if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
          const path = result.filePaths[0]
          const name = path.split(/[/\\]/).pop() || path
          return {
            name,
            path,
            isDirectory: true
          }
        }
      }
    } catch (error) {
      console.error('Failed to open native file dialog:', error)
    }
    
    return null
  }, [isElectron])

  const onFolderSelected = useCallback(async (type: FolderType, folderPath: string) => {
    console.log('Folder type selected:', type, 'for path:', folderPath)
    try {
      const response = await readMediaMetadataApi(folderPath)
      const metadata = response.data

      if(!metadata) {
        console.error('Failed to read media metadata')
        return
      }

      const folderTypeMap: Record<FolderType, "tvshow-folder" | "movie-folder" | "music-folder"> = {
        tvshow: "tvshow-folder",
        movie: "movie-folder",
        music: "music-folder"
      }
      metadata.type = folderTypeMap[type]

      addMediaMetadata(metadata)
    } catch (error) {
      console.error('Failed to read media metadata:', error)
    }
  }, [addMediaMetadata])

  const handleOpenFolderMenuClick = useCallback(() => {
    if (isElectron()) {
      openOpenFolder((type: FolderType) => {
        console.log(`Selected folder type: ${type}`)
        openNativeFileDialog().then((selectedFile) => {
          if (selectedFile) {
            console.log(`Selected folder: ${selectedFile.path}`)
          }
        })
      })
    } else {
      openFilePicker((file: FileItem) => {
        console.log(`Selected folder: ${file.path}`)
        openOpenFolder((type: FolderType) => {
          onFolderSelected(type, file.path)
        }, file.path)
      }, {
        title: "Select Folder",
        description: "Choose a folder to open"
      })
    }
  }, [isElectron, openOpenFolder, openNativeFileDialog, openFilePicker, onFolderSelected])

  // Convert mediaMetadatas to folders
  const folders: MediaFolderListItemProps[] = useMemo(() => {
    return mediaMetadatas.map((metadata) => {
      return {
        mediaName: metadata.tmdbTvShow?.name ?? (basename(metadata.mediaFolderPath!) ?? '未识别媒体名称'),
        path: metadata.mediaFolderPath,
        mediaType: metadata.type === "tvshow-folder" ? "tvshow" : metadata.type === "movie-folder" ? "movie" : "tvshow-folder",
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

  const handleMediaFolderListItemClick = useCallback((path: string) => {
    const index = mediaMetadatas.findIndex((metadata) => metadata.mediaFolderPath === path)
    if (index !== -1) {
      setSelectedMediaMetadata(index)
    }
  }, [mediaMetadatas, setSelectedMediaMetadata])

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
          <Toolbar onOpenFolderMenuClick={handleOpenFolderMenuClick} />
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
            handleMediaFolderListItemClick={handleMediaFolderListItemClick}
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
          {folders.length > 0 && selectedMediaMetadata?.type === "tvshow-folder" && (
            <div style={{ padding: "20px", overflow: "auto" }}>
              <TvShowPanel />
            </div>
          )}
          {folders.length > 0 && selectedMediaMetadata?.type !== "tvshow-folder" && selectedMediaMetadata && (
            <LocalFilePanel mediaFolderPath={selectedMediaMetadata.mediaFolderPath} />
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
      <WebSocketHandlers />
      <Toaster position="bottom-right" />
    </div>
  )
}

