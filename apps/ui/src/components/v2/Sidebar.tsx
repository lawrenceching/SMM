import { SearchForm } from "@/components/search-form"
import { MediaFolderToolbar, type SortOrder, type FilterType } from "@/components/shared/MediaFolderToolbar"
import { FolderListItem } from "../sidebar/FolderListItem"
import { useSidebar } from "@/hooks/useSidebar"
import { useTranslation } from "@/lib/i18n"

export type { SortOrder, FilterType }

export interface SidebarProps {
  onDeleteSelected?: (paths: string[]) => void
}

export function Sidebar({ onDeleteSelected }: SidebarProps) {
  const { t } = useTranslation(["components"])
  const {
    sortOrder,
    filterType,
    searchQuery,
    setSortOrder,
    setFilterType,
    setSearchQuery,
    filteredAndSortedFolders,
    selectedFolderPathsSet,
    primarySelectedPath,
    applyFolderClick,
    handleListKeyDown,
    handleRename,
    handleOpenInExplorer,
    handleDeleteItem,
  } = useSidebar({ onDeleteSelected })

  return (
    <div className="flex flex-col h-full w-full" data-testid="sidebar-container">
      <div className="py-2 px-3 border-b border-border bg-background" data-testid="sidebar-toolbar">
        <MediaFolderToolbar
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
          filterType={filterType}
          onFilterTypeChange={setFilterType}
        />
      </div>

      <div className="py-2 px-3 border-b border-border bg-background" data-testid="sidebar-search">
        <SearchForm
          value={searchQuery}
          onValueChange={setSearchQuery}
          placeholder={t("sidebar.searchPlaceholder")}
        />
      </div>

      <div
        className="flex-1 overflow-y-auto overflow-x-hidden"
        tabIndex={0}
        onKeyDown={handleListKeyDown}
        data-testid="sidebar-folder-list"
      >
        {filteredAndSortedFolders.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm" data-testid="sidebar-empty-state">
            {t("sidebar.emptyState")}
          </div>
        ) : (
          <div className="flex flex-col outline-none" data-testid="sidebar-folder-items">
            {filteredAndSortedFolders.map((folder, index) => (
              <div key={folder.path} className="border-b border-border" data-testid={`sidebar-folder-item-${index}`}>
                <FolderListItem
                  {...folder}
                  isSelected={selectedFolderPathsSet.has(folder.path)}
                  isPrimary={primarySelectedPath === folder.path}
                  onRename={() => handleRename(folder.path)}
                  onOpenInExplorer={() => void handleOpenInExplorer(folder.path)}
                  onDelete={() => handleDeleteItem(folder.path)}
                  onClick={(e) =>
                    applyFolderClick(folder.path, e.ctrlKey || e.metaKey)
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
