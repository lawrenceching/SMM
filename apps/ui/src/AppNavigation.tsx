import { useState } from "react"
import { Toolbox } from "@/components/mobile/Toolbox"
import { NavBar } from "@/components/mobile/NavBar"
import type { SortOrder, FilterType } from "@/components/shared/MediaFolderToolbar"
import { Assistant } from "@/ai/Assistant"
import { ChevronDown, ChevronUp } from "lucide-react"

type Page = "list" | "detail"

export default function AppNavigation() {
  const [currentPage] = useState<Page>("list")

  // Sidebar state (search, sort, filter)
  const [sortOrder, setSortOrder] = useState<SortOrder>("alphabetical")
  const [filterType, setFilterType] = useState<FilterType>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [isToolboxExpanded, setIsToolboxExpanded] = useState<boolean>(false)
  
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
      <div className="relative h-full w-full overflow-hidden bg-background">
      {/* 列表页 */}
      <div
        className="absolute inset-0 flex h-full w-full flex-col bg-muted/30 transition-transform duration-300 ease-out"
        style={{
          transform: currentPage === "list" ? "translateX(0)" : "translateX(-100%)",
        }}
      >
        {/* 列表页导航栏 */}
        <NavBar title="列表">
          <button
            type="button"
            onClick={() => setIsToolboxExpanded(!isToolboxExpanded)}
            className="flex cursor-pointer items-center justify-center rounded-md p-2 transition-colors hover:bg-accent"
            aria-expanded={isToolboxExpanded}
          >
            {isToolboxExpanded ? (
              <ChevronUp className="h-5 w-5 text-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-foreground" />
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
        {/* <Navigation
          filteredAndSortedFolders={filteredAndSortedFolders}
          handleMediaFolderListItemClick={handleMediaFolderListItemClick}
        /> */}
      </div>

      {/* 内容页 */}
      <div
        className="absolute inset-0 flex h-full w-full flex-col bg-background transition-transform duration-300 ease-out"
        style={{
          transform: currentPage === "detail" ? "translateX(0)" : "translateX(100%)",
        }}
      >
        {/* 内容页导航栏 */}
        {/* <NavBar 
          title={selectedMediaMetadata?.tvShow?.name ?? selectedMediaMetadata?.movie?.name ?? "详情"}
          onBack={handleBack}
        >
          <ViewSwitcher 
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            disabled={!selectedMediaMetadata}
          />
        </NavBar> */}

        {/* 内容区域 */}
        {/* <div
          style={{
            flex: 1,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {!selectedMediaMetadata ? (
            <div className="flex h-full items-center justify-center p-4 text-lg text-muted-foreground">
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
        </div> */}
      </div>
      </div>

      <Assistant />
    </>
  )
}

