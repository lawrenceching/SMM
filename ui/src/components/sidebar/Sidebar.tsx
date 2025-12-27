import { Menu } from "@/components/menu"
import { SearchForm } from "@/components/search-form"
import { MediaFolderListItem, type MediaFolderListItemProps } from "@/components/sidebar/MediaFolderListItem"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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

interface MediaFolderToolbarProps {
  sortOrder: SortOrder
  onSortOrderChange: (order: SortOrder) => void
  filterType: FilterType
  onFilterTypeChange: (type: FilterType) => void
}

function MediaFolderToolbar({
  sortOrder,
  onSortOrderChange,
  filterType,
  onFilterTypeChange,
}: MediaFolderToolbarProps) {
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

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b">
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <Select onValueChange={onSortOrderChange}>
              <SelectTrigger 
                size="sm" 
                className={cn(
                  "h-8 w-8 p-0 justify-center!",
                  "[&>svg:last-child]:hidden" // Hide the default chevron icon
                )}
              >
                <ArrowUpDown className="h-4 w-4" />
                <SelectValue className="sr-only" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alphabetical">按字母顺序</SelectItem>
                <SelectItem value="reverse-alphabetical">按字母倒序</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>排序: {sortLabels[sortOrder]}</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <Select onValueChange={onFilterTypeChange}>
              <SelectTrigger 
                size="sm" 
                className={cn(
                  "h-8 w-8 p-0 justify-center!",
                  "[&>svg:last-child]:hidden" // Hide the default chevron icon
                )}
              >
                <Filter className="h-4 w-4" />
                <SelectValue className="sr-only" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="tvshow">电视剧</SelectItem>
                <SelectItem value="movie">电影</SelectItem>
                <SelectItem value="music">音乐</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>筛选: {filterLabels[filterType]}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

export interface SidebarProps {
  handleOpenFolderMenuClick: () => void
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
  handleOpenFolderMenuClick,
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
    <>
      <Menu onOpenFolderMenuClick={handleOpenFolderMenuClick} />
      <MediaFolderToolbar
        sortOrder={sortOrder}
        onSortOrderChange={onSortOrderChange}
        filterType={filterType}
        onFilterTypeChange={onFilterTypeChange}
      />
      <div className="p-1">
        <SearchForm 
          value={searchQuery}
          onValueChange={onSearchQueryChange}
          placeholder="Search media folders..."
        />
      </div>
      <div className="flex flex-col gap-4 p-4">
        {filteredAndSortedFolders.map((folder) => (
          <MediaFolderListItem key={folder.path} {...folder} onClick={() => handleMediaFolderListItemClick(folder.path)} />
        ))}
      </div>
    </>
  )
}

