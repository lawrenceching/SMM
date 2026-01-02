import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { Sidebar, type SortOrder, type FilterType } from "@/components/v2/Sidebar"
import { useMediaMetadata } from "@/components/media-metadata-provider"
import { basename } from "@/lib/path"
import type { MediaFolderListItemProps } from "@/components/sidebar/MediaFolderListItem"

export default function AppV2() {
  const [sidebarWidth, setSidebarWidth] = useState(250) // 初始侧边栏宽度
  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const resizeRef = useRef<HTMLDivElement>(null)

  // Sidebar state
  const [sortOrder, setSortOrder] = useState<SortOrder>("alphabetical")
  const [filterType, setFilterType] = useState<FilterType>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")

  // Media metadata
  const { mediaMetadatas, setSelectedMediaMetadata } = useMediaMetadata()

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
          <div
            style={{
              width: "32px",
              height: "28px",
              backgroundColor: "#e8e8e8",
              borderRadius: "3px",
              border: "1px solid #d0d0d0",
            }}
          />
          <div
            style={{
              width: "32px",
              height: "28px",
              backgroundColor: "#e8e8e8",
              borderRadius: "3px",
              border: "1px solid #d0d0d0",
            }}
          />
          <div
            style={{
              width: "32px",
              height: "28px",
              backgroundColor: "#e8e8e8",
              borderRadius: "3px",
              border: "1px solid #d0d0d0",
            }}
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
            overflow: "auto",
            padding: "20px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "16px",
            }}
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: "150px",
                  backgroundColor: "#f8f8f8",
                  borderRadius: "4px",
                  border: "1px solid #e0e0e0",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                }}
              />
            ))}
          </div>
        </div>

        {/* 状态栏 */}
        <div
          style={{
            gridArea: "statusbar",
            backgroundColor: "#e8e8e8",
            borderTop: "1px solid #d0d0d0",
            padding: "4px 12px",
            display: "flex",
            alignItems: "center",
            fontSize: "12px",
            color: "#555555",
            boxShadow: "0 -1px 2px rgba(0,0,0,0.05)",
          }}
        >
          <span>就绪</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: "16px" }}>
            <span>项目: {filteredAndSortedFolders.length}</span>
            <span>总计: {folders.length}</span>
          </div>
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
    </div>
  )
}

