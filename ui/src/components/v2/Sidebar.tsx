import { SearchForm } from "@/components/search-form"
import { MediaFolderListItem, type MediaFolderListItemProps } from "@/components/sidebar/MediaFolderListItem"
import { MediaFolderToolbar, type SortOrder, type FilterType } from "@/components/shared/MediaFolderToolbar"
import { MediaFolderListItemV2 } from "../sidebar/MediaFolderListItemV2"

export type { SortOrder, FilterType }

export interface SidebarProps {
  sortOrder: SortOrder
  onSortOrderChange: (order: SortOrder) => void
  filterType: FilterType
  onFilterTypeChange: (type: FilterType) => void
  searchQuery: string
  onSearchQueryChange: (query: string) => void
  filteredAndSortedFolders: MediaFolderListItemProps[]
  handleMediaFolderListItemClick: (path: string) => void
}


export function Sidebar({
  sortOrder,
  onSortOrderChange,
  filterType,
  onFilterTypeChange,
  searchQuery,
  onSearchQueryChange,
  filteredAndSortedFolders,
  handleMediaFolderListItemClick,
}: SidebarProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
      }}
    >
      {/* 工具栏：排序和筛选按钮 */}
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid #d0d0d0",
          backgroundColor: "#ffffff",
        }}
      >
        <MediaFolderToolbar
          sortOrder={sortOrder}
          onSortOrderChange={onSortOrderChange}
          filterType={filterType}
          onFilterTypeChange={onFilterTypeChange}
        />
      </div>

      {/* 搜索框 */}
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid #e0e0e0",
          backgroundColor: "#ffffff",
        }}
      >
        <SearchForm
          value={searchQuery}
          onValueChange={onSearchQueryChange}
          placeholder="搜索媒体文件夹..."
        />
      </div>

      {/* 列表 */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "8px",
        }}
      >
        {filteredAndSortedFolders.length === 0 ? (
          <div
            style={{
              padding: "16px",
              textAlign: "center",
              color: "#666666",
              fontSize: "14px",
            }}
          >
            没有找到媒体文件夹
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            {filteredAndSortedFolders.map((folder) => (
              <MediaFolderListItemV2
                key={folder.path}
                {...folder}
                onClick={() => handleMediaFolderListItemClick(folder.path)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

