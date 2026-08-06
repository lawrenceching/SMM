import { cn } from "@/lib/utils"
import { FilterButton } from "./FilterButton";
import { SortingButton } from "./SortingButton";
import type { FilterOption, SortingOption } from "./FilterButton";
import type { SortOrder, FilterType } from "@/stores/sidebarStore";
import { useTranslation } from "@/lib/i18n";

export type { SortOrder, FilterType }

export interface MediaFolderToolbarProps {
  sortOrder: SortOrder
  onSortOrderChange: (order: SortOrder) => void
  filterType: FilterType
  onFilterTypeChange: (type: FilterType) => void
  className?: string
  style?: React.CSSProperties
}

export function MediaFolderToolbar({
  sortOrder,
  onSortOrderChange,
  filterType,
  onFilterTypeChange,
  className,
  style,
}: MediaFolderToolbarProps) {
  const { t } = useTranslation(["components"])

  const sortOptions: SortingOption[] = [
    { value: "alphabetical", label: t("sidebar.toolbar.sortAlphabetical") },
    { value: "reverse-alphabetical", label: t("sidebar.toolbar.sortReverseAlphabetical") },
  ];

  const filterOptions: FilterOption[] = [
    { value: "all", label: t("sidebar.toolbar.filterAll") },
    { value: "tvshow", label: t("sidebar.toolbar.filterTvShow") },
    { value: "movie", label: t("sidebar.toolbar.filterMovie") },
    { value: "music", label: t("sidebar.toolbar.filterMusic") },
  ];

  return (
    <div
      className={cn("flex items-center gap-2", className)}
      style={style}
    >
      <SortingButton
        value={sortOrder}
        options={sortOptions}
        onValueChange={onSortOrderChange}
        placeholder={t("sidebar.toolbar.sort")}
      />

      <FilterButton
        value={filterType}
        options={filterOptions}
        onValueChange={onFilterTypeChange}
        placeholder={t("sidebar.toolbar.filter")}
      />
    </div>
  )
}

