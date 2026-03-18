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
    <div className="flex flex-col border-b border-border bg-background">
      <div className="border-b border-border px-3 py-2">
        <MediaFolderToolbar
          sortOrder={sortOrder}
          onSortOrderChange={onSortOrderChange}
          filterType={filterType}
          onFilterTypeChange={onFilterTypeChange}
        />
      </div>

      <div className="px-3 py-2">
        <SearchForm
          value={searchQuery}
          onValueChange={onSearchQueryChange}
          placeholder="搜索媒体文件夹..."
        />
      </div>
    </div>
  )
}
