import { useCallback } from "react"
import { SearchForm } from "@/components/search-form"
import { type MediaFolderListItemProps } from "@/components/sidebar/MediaFolderListItem"
import { MediaFolderToolbar, type SortOrder, type FilterType } from "@/components/shared/MediaFolderToolbar"
import { MediaFolderListItemV2 } from "../sidebar/MediaFolderListItemV2"

export type { SortOrder, FilterType }

export interface SidebarFolderClickModifiers {
  ctrlKey: boolean
  metaKey: boolean
}

export interface SidebarProps {
  sortOrder: SortOrder
  onSortOrderChange: (order: SortOrder) => void
  filterType: FilterType
  onFilterTypeChange: (type: FilterType) => void
  searchQuery: string
  onSearchQueryChange: (query: string) => void
  filteredAndSortedFolders: MediaFolderListItemProps[]
  selectedFolderPaths: Set<string>
  primaryFolderPath: string | undefined
  onFolderClick: (path: string, modifiers: SidebarFolderClickModifiers) => void
  onSelectAll: () => void
  onDeleteSelected: (paths: string[]) => void
}

export function Sidebar({
  sortOrder,
  onSortOrderChange,
  filterType,
  onFilterTypeChange,
  searchQuery,
  onSearchQueryChange,
  filteredAndSortedFolders,
  selectedFolderPaths,
  primaryFolderPath,
  onFolderClick,
  onSelectAll,
  onDeleteSelected,
}: SidebarProps) {
  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault()
        onSelectAll()
      }
      if (e.key === "Delete" && selectedFolderPaths.size > 0) {
        e.preventDefault()
        onDeleteSelected(Array.from(selectedFolderPaths))
      }
    },
    [onSelectAll, onDeleteSelected, selectedFolderPaths.size]
  )

  return (
    <div className="flex flex-col h-full w-full">
      {/* 工具栏：排序和筛选按钮 */}
      <div className="py-2 px-3 border-b border-border bg-background">
        <MediaFolderToolbar
          sortOrder={sortOrder}
          onSortOrderChange={onSortOrderChange}
          filterType={filterType}
          onFilterTypeChange={onFilterTypeChange}
        />
      </div>

      {/* 搜索框 */}
      <div className="py-2 px-3 border-b border-border bg-background">
        <SearchForm
          value={searchQuery}
          onValueChange={onSearchQueryChange}
          placeholder="搜索媒体文件夹..."
        />
      </div>

      {/* 列表：keydown only when focus is here (Ctrl+A / Cmd+A) */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden"
        tabIndex={0}
        onKeyDown={handleListKeyDown}
      >
        {filteredAndSortedFolders.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            没有找到媒体文件夹
          </div>
        ) : (
          <div className="flex flex-col outline-none">
            {filteredAndSortedFolders.map((folder) => (
              <div key={folder.path} className="border-b border-border">
                <MediaFolderListItemV2
                  {...folder}
                  isSelected={selectedFolderPaths.has(folder.path)}
                  isPrimary={primaryFolderPath === folder.path}
                  selectedFolderPaths={selectedFolderPaths}
                  onDeleteSelected={onDeleteSelected}
                  onClick={(e) =>
                    onFolderClick(folder.path, {
                      ctrlKey: e.ctrlKey,
                      metaKey: e.metaKey,
                    })
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

