import { SearchForm } from "@/components/search-form"
import { MediaFolderToolbar, type SortOrder, type FilterType } from "@/components/shared/MediaFolderToolbar"

export interface ToolboxProps {
  sortOrder: SortOrder
  onSortOrderChange: (order: SortOrder) => void
  filterType: FilterType
  onFilterTypeChange: (type: FilterType) => void
  searchQuery: string
  onSearchQueryChange: (query: string) => void
}

export function Toolbox({
  sortOrder,
  onSortOrderChange,
  filterType,
  onFilterTypeChange,
  searchQuery,
  onSearchQueryChange,
}: ToolboxProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#ffffff",
        borderBottom: "1px solid #e0e0e0",
      }}
    >
      {/* 工具栏：排序和筛选按钮 */}
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid #e0e0e0",
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
        }}
      >
        <SearchForm
          value={searchQuery}
          onValueChange={onSearchQueryChange}
          placeholder="搜索媒体文件夹..."
        />
      </div>
    </div>
  )
}

