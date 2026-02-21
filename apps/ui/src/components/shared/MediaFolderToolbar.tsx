import { cn } from "@/lib/utils"
import { FilterButton } from "./FilterButton";
import { SortingButton } from "./SortingButton";
import type { FilterOption, SortingOption } from "./FilterButton";

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

const sortOptions: SortingOption[] = [
  { value: "alphabetical", label: "按字母顺序" },
  { value: "reverse-alphabetical", label: "按字母倒序" },
];

const filterOptions: FilterOption[] = [
  { value: "all", label: "全部类型" },
  { value: "tvshow", label: "电视剧" },
  { value: "movie", label: "电影" },
  { value: "music", label: "音乐" },
];

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
      <SortingButton
        value={sortOrder}
        options={sortOptions}
        onValueChange={onSortOrderChange}
        placeholder="排序"
        tooltipLabel="按字母顺序"
      />

      <FilterButton
        value={filterType}
        options={filterOptions}
        onValueChange={onFilterTypeChange}
        placeholder="筛选"
        tooltipLabel="全部类型"
      />
    </div>
  )
}

