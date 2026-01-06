import { useState, useMemo, useCallback, useEffect } from "react"
import { Navigation } from "@/components/mobile/Navigation"
import { Toolbox } from "@/components/mobile/Toolbox"
import { NavBar } from "@/components/mobile/NavBar"
import { useMediaMetadata } from "@/components/media-metadata-provider"
import { basename } from "@/lib/path"
import type { MediaFolderListItemProps } from "@/components/sidebar/MediaFolderListItem"
import type { SortOrder, FilterType } from "@/components/shared/MediaFolderToolbar"
import TvShowPanel from "@/components/TvShowPanel"
import { LocalFilePanel } from "@/components/LocalFilePanel"
import { Assistant } from "@/ai/Assistant"
import { ChevronDown, ChevronUp } from "lucide-react"
import { ViewSwitcher, type ViewMode } from "@/components/v2/ViewSwitcher"

type Page = "list" | "detail"

export default function AppNavigation() {
  const [currentPage, setCurrentPage] = useState<Page>("list")
  const [selectedItemPath, setSelectedItemPath] = useState<string | null>(null)

  // Sidebar state (search, sort, filter)
  const [sortOrder, setSortOrder] = useState<SortOrder>("alphabetical")
  const [filterType, setFilterType] = useState<FilterType>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [isToolboxExpanded, setIsToolboxExpanded] = useState<boolean>(false)
  
  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>("metadata")

  // Media metadata
  const { mediaMetadatas, setSelectedMediaMetadata, selectedMediaMetadata: globalSelectedMediaMetadata } = useMediaMetadata()

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
      setSelectedItemPath(path)
      setCurrentPage("detail")
    }
  }, [mediaMetadatas, setSelectedMediaMetadata])

  const handleBack = () => {
    setCurrentPage("list")
  }

  // Sync with global selected media metadata when switching to mobile view
  useEffect(() => {
    if (globalSelectedMediaMetadata?.mediaFolderPath) {
      // If there's a globally selected media metadata, show detail view
      setSelectedItemPath(globalSelectedMediaMetadata.mediaFolderPath)
      setCurrentPage("detail")
    } else {
      // If no media metadata is selected, show list view
      setSelectedItemPath(null)
      setCurrentPage("list")
    }
  }, [globalSelectedMediaMetadata])

  // Get selected media metadata (prefer local state, fallback to global)
  const selectedMediaMetadata = useMemo(() => {
    if (selectedItemPath) {
      return mediaMetadatas.find((metadata) => metadata.mediaFolderPath === selectedItemPath)
    }
    // Fallback to global selected media metadata if local state is not set
    return globalSelectedMediaMetadata ?? null
  }, [selectedItemPath, mediaMetadatas, globalSelectedMediaMetadata])

  return (
    <>
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }
      `}</style>
      <div
        style={{
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
          position: "relative",
          backgroundColor: "#ffffff",
        }}
      >
      {/* 列表页 */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          transform: currentPage === "list" ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 300ms ease-out",
          backgroundColor: "#f5f5f5",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* 列表页导航栏 */}
        <NavBar title="列表">
          <button
            onClick={() => setIsToolboxExpanded(!isToolboxExpanded)}
            style={{
              backgroundColor: "transparent",
              border: "none",
              padding: "8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "4px",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#f0f0f0"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent"
            }}
          >
            {isToolboxExpanded ? (
              <ChevronUp className="h-5 w-5" color="#333333" />
            ) : (
              <ChevronDown className="h-5 w-5" color="#333333" />
            )}
          </button>
        </NavBar>

        {/* Toolbox with expand/collapse animation */}
        <div
          style={{
            maxHeight: isToolboxExpanded ? "200px" : "0",
            overflow: "hidden",
            transition: "max-height 300ms ease-out",
          }}
        >
          <Toolbox
            sortOrder={sortOrder}
            onSortOrderChange={setSortOrder}
            filterType={filterType}
            onFilterTypeChange={setFilterType}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
          />
        </div>

        {/* 列表内容 */}
        <Navigation
          filteredAndSortedFolders={filteredAndSortedFolders}
          handleMediaFolderListItemClick={handleMediaFolderListItemClick}
        />
      </div>

      {/* 内容页 */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          transform: currentPage === "detail" ? "translateX(0)" : "translateX(100%)",
          transition: "transform 300ms ease-out",
          backgroundColor: "#ffffff",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* 内容页导航栏 */}
        <NavBar 
          title={selectedMediaMetadata?.tmdbTvShow?.name ?? selectedMediaMetadata?.tmdbMovie?.title ?? "详情"}
          onBack={handleBack}
        >
          <ViewSwitcher 
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            disabled={!selectedMediaMetadata}
          />
        </NavBar>

        {/* 内容区域 */}
        <div
          style={{
            flex: 1,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {!selectedMediaMetadata ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                fontSize: "18px",
                color: "#666666",
                padding: "16px",
              }}
            >
              请选择一个媒体文件夹
            </div>
          ) : (
            <>
              {viewMode === "metadata" && (
                <>
                  {selectedMediaMetadata.type === "tvshow-folder" ? (
                    <div
                      style={{
                        flex: 1,
                        overflowY: "auto",
                        overflowX: "hidden",
                        padding: "0",
                      }}
                    >
                      <TvShowPanel />
                    </div>
                  ) : (
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
      </div>
      </div>

      <Assistant />
    </>
  )
}

