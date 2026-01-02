import { useState, useMemo, useCallback } from "react"
import { Navigation } from "@/components/mobile/Navigation"
import { useMediaMetadata } from "@/components/media-metadata-provider"
import { basename } from "@/lib/path"
import type { MediaFolderListItemProps } from "@/components/sidebar/MediaFolderListItem"
import type { SortOrder, FilterType } from "@/components/v2/Sidebar"
import TvShowPanel from "@/components/TvShowPanel"

type Page = "list" | "detail"

export default function AppNavigation() {
  const [currentPage, setCurrentPage] = useState<Page>("list")
  const [selectedItemPath, setSelectedItemPath] = useState<string | null>(null)

  // Sidebar state (for future use: search, sort, filter)
  const sortOrder: SortOrder = "alphabetical"
  const filterType: FilterType = "all"
  const searchQuery = ""

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
      setSelectedItemPath(path)
      setCurrentPage("detail")
    }
  }, [mediaMetadatas, setSelectedMediaMetadata])

  const handleBack = () => {
    setCurrentPage("list")
  }

  // Get selected media metadata
  const selectedMediaMetadata = useMemo(() => {
    if (!selectedItemPath) return null
    return mediaMetadatas.find((metadata) => metadata.mediaFolderPath === selectedItemPath)
  }, [selectedItemPath, mediaMetadatas])

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
        {/* 列表页标题栏 */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderBottom: "1px solid #e0e0e0",
            padding: "0 16px",
            height: "48px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            display: "flex",
            alignItems: "center",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: "20px",
              fontWeight: "600",
              color: "#333333",
            }}
          >
            列表
          </h1>
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
        <div
          style={{
            backgroundColor: "#ffffff",
            borderBottom: "1px solid #e0e0e0",
            padding: "0 16px",
            height: "48px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          <button
            onClick={handleBack}
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
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h2
            style={{
              margin: 0,
              fontSize: "18px",
              fontWeight: "600",
              color: "#333333",
            }}
          >
            {selectedMediaMetadata?.tmdbTvShow?.name ?? selectedMediaMetadata?.tmdbMovie?.title ?? "详情"}
          </h2>
        </div>

        {/* 内容区域 */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "0",
          }}
        >
          {selectedMediaMetadata?.type === "tvshow-folder" ? (
            <TvShowPanel />
          ) : selectedMediaMetadata ? (
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
              Not Yet Implemented
            </div>
          ) : (
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
          )}
        </div>
      </div>
      </div>
    </>
  )
}

