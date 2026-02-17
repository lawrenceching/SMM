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

export interface MediaFolderToolbarProps {
  sortOrder: SortOrder
  onSortOrderChange: (order: SortOrder) => void
  filterType: FilterType
  onFilterTypeChange: (type: FilterType) => void
  className?: string
  style?: React.CSSProperties
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

export function MediaFolderToolbar({
  sortOrder,
  onSortOrderChange,
  filterType,
  onFilterTypeChange,
  className,
  style,
}: MediaFolderToolbarProps) {
  return (
    <div
      className={cn("flex items-center gap-2", className)}
      style={style}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Select value={sortOrder} onValueChange={onSortOrderChange}>
            <SelectTrigger
              size="sm"
              data-testid="sort-select-trigger"
              className={cn(
                "h-8 w-8 p-0 justify-center",
                "[&>svg:last-child]:hidden"
              )}
            >
              <ArrowUpDown className="h-4 w-4" />
              <span className="sr-only">排序</span>
            </SelectTrigger>
            <SelectContent data-testid="sort-select-content">
              <SelectItem value="alphabetical" data-testid="sort-option-alphabetical">按字母顺序</SelectItem>
              <SelectItem value="reverse-alphabetical" data-testid="sort-option-reverse-alphabetical">按字母倒序</SelectItem>
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
              data-testid="filter-select-trigger"
              className={cn(
                "h-8 w-8 p-0 justify-center",
                "[&>svg:last-child]:hidden"
              )}
            >
              <Filter className="h-4 w-4" />
              <span className="sr-only">筛选</span>
            </SelectTrigger>
            <SelectContent data-testid="filter-select-content">
              <SelectItem value="all" data-testid="filter-option-all">全部类型</SelectItem>
              <SelectItem value="tvshow" data-testid="filter-option-tvshow">电视剧</SelectItem>
              <SelectItem value="movie" data-testid="filter-option-movie">电影</SelectItem>
              <SelectItem value="music" data-testid="filter-option-music">音乐</SelectItem>
            </SelectContent>
          </Select>
        </TooltipTrigger>
        <TooltipContent>
          <p>筛选: {filterLabels[filterType]}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

