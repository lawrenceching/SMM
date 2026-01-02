import { SearchForm } from "@/components/search-form"
import { MediaFolderListItem, type MediaFolderListItemProps } from "@/components/sidebar/MediaFolderListItem"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ArrowUpDown, Filter } from "lucide-react"
import { cn } from "@/lib/utils"

export type SortOrder = "alphabetical" | "reverse-alphabetical"
export type FilterType = "all" | "tvshow" | "movie" | "music"

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

const sortLabels: Record<SortOrder, string> = {
  alphabetical: "按字母顺序",
  "reverse-alphabetical": "按字母倒序",
}

const filterLabels: Record<FilterType, string> = {
  all: "全部类型",
  tvshow: "电视剧",
  movie: "电影",
  music: "音乐",
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
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 12px",
          borderBottom: "1px solid #d0d0d0",
          backgroundColor: "#ffffff",
        }}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Select value={sortOrder} onValueChange={onSortOrderChange}>
              <SelectTrigger
                size="sm"
                className={cn(
                  "h-8 w-8 p-0 justify-center",
                  "[&>svg:last-child]:hidden"
                )}
              >
                <ArrowUpDown className="h-4 w-4" />
                <span className="sr-only">排序</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alphabetical">按字母顺序</SelectItem>
                <SelectItem value="reverse-alphabetical">按字母倒序</SelectItem>
              </SelectContent>
            </Select>
          </TooltipTrigger>
          <TooltipContent>
            <p>排序: {sortLabels[sortOrder]}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Select value={filterType} onValueChange={onFilterTypeChange}>
              <SelectTrigger
                size="sm"
                className={cn(
                  "h-8 w-8 p-0 justify-center",
                  "[&>svg:last-child]:hidden"
                )}
              >
                <Filter className="h-4 w-4" />
                <span className="sr-only">筛选</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="tvshow">电视剧</SelectItem>
                <SelectItem value="movie">电影</SelectItem>
                <SelectItem value="music">音乐</SelectItem>
              </SelectContent>
            </Select>
          </TooltipTrigger>
          <TooltipContent>
            <p>筛选: {filterLabels[filterType]}</p>
          </TooltipContent>
        </Tooltip>
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
              <MediaFolderListItem
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

