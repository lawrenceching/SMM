import { useCallback, useMemo, useState, type ComponentType, type KeyboardEvent, type MouseEvent } from "react"
import { lazy, Suspense } from "react"
import { Loader2 } from "lucide-react"
import { SearchForm } from "@/components/search-form"
import { MediaFolderToolbar, type SortOrder, type FilterType } from "@/components/shared/MediaFolderToolbar"
import { useSidebar } from "@/hooks/useSidebar"
import { useTranslation } from "@/lib/i18n"
import { isPathInSelection, nextFolderSelection } from "@/lib/sidebarFolderSelection"
import type { FolderListItemContainerProps } from "./FolderListItemContainer"

export type { SortOrder, FilterType }

const DefaultFolderListItemContainer = lazy(() =>
  import("./FolderListItemContainer").then((m) => ({
    default: m.FolderListItemContainer,
  })),
)

function FolderListItemFallback() {
  return (
    <div className="flex items-center justify-center gap-3 px-3 py-2.5" data-testid="sidebar-folder-item-fallback">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    </div>
  )
}

export interface SidebarSelectionChange {
  selectedPaths: string[]
  primaryPath: string
  multi: boolean
}

export type FolderListItemSlot = ComponentType<FolderListItemContainerProps>

export interface SidebarProps {
  onDeleteSelected?: (paths: string[]) => void
  /**
   * Optional list-item component (e.g. Storybook mounts pure {@link FolderListItem}).
   * When omitted, lazily loads {@link FolderListItemContainer}.
   */
  folderListItemSlot?: FolderListItemSlot
  /** Controlled selected folder paths (UI). When omitted, Sidebar manages selection internally. */
  selectedPaths?: string[]
  /** Controlled primary selection path (UI). */
  primaryPath?: string
  /** Fired after selection UI changes (single or multi). */
  onSelectionChange?: (next: SidebarSelectionChange) => void
  /** Controlled search query (UI). When omitted, Sidebar manages search internally. */
  searchQuery?: string
  /** Fired when the search box value changes. */
  onSearchQueryChange?: (query: string) => void
}

export function Sidebar({
  onDeleteSelected,
  folderListItemSlot,
  selectedPaths: selectedPathsProp,
  primaryPath: primaryPathProp,
  onSelectionChange,
  searchQuery: searchQueryProp,
  onSearchQueryChange,
}: SidebarProps) {
  const { t } = useTranslation(["components"])

  const isSearchControlled = searchQueryProp !== undefined
  const [internalSearchQuery, setInternalSearchQuery] = useState("")
  const searchQuery = isSearchControlled ? searchQueryProp : internalSearchQuery

  const setSearchQuery = useCallback(
    (query: string) => {
      if (!isSearchControlled) {
        setInternalSearchQuery(query)
      }
      onSearchQueryChange?.(query)
    },
    [isSearchControlled, onSearchQueryChange],
  )

  const {
    sortOrder,
    filterType,
    setSortOrder,
    setFilterType,
    folders,
    handleRename,
    handleOpenInExplorer,
    handleDeletePaths,
  } = useSidebar({ onDeleteSelected, searchQuery })

  const isSelectionControlled = selectedPathsProp !== undefined
  const [internalSelectedPaths, setInternalSelectedPaths] = useState<string[]>([])
  const [internalPrimaryPath, setInternalPrimaryPath] = useState("")

  const selectedPaths = isSelectionControlled ? selectedPathsProp : internalSelectedPaths
  const primaryPath = isSelectionControlled
    ? (primaryPathProp ?? "")
    : internalPrimaryPath

  const selectedFolderPathsSet = useMemo(() => new Set(selectedPaths), [selectedPaths])

  const commitSelection = useCallback(
    (next: SidebarSelectionChange) => {
      if (!isSelectionControlled) {
        setInternalSelectedPaths(next.selectedPaths)
        setInternalPrimaryPath(next.primaryPath)
      }
      onSelectionChange?.(next)
    },
    [isSelectionControlled, onSelectionChange],
  )

  const handleFolderClick = useCallback(
    (path: string, e: MouseEvent) => {
      const multi = e.ctrlKey || e.metaKey
      const next = nextFolderSelection(selectedPaths, path, multi)
      commitSelection({ ...next, multi })
    },
    [selectedPaths, commitSelection],
  )

  const handleListKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault()
        const paths = [...folders]
        commitSelection({
          selectedPaths: paths,
          primaryPath: paths[0] ?? "",
          multi: true,
        })
      }
      if (e.key === "Delete" && selectedPaths.length > 0) {
        e.preventDefault()
        void handleDeletePaths(selectedPaths)
      }
    },
    [commitSelection, folders, handleDeletePaths, selectedPaths],
  )

  const handleDeleteItem = useCallback(
    (path: string) => {
      const shouldDeleteSelection =
        selectedPaths.length > 0 && isPathInSelection(path, selectedPaths)
      void handleDeletePaths(shouldDeleteSelection ? selectedPaths : [path])
    },
    [handleDeletePaths, selectedPaths],
  )

  const FolderListItemSlot = folderListItemSlot ?? DefaultFolderListItemContainer

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
        {folders.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm" data-testid="sidebar-empty-state">
            {t("sidebar.emptyState")}
          </div>
        ) : (
          <div className="flex flex-col outline-none" data-testid="sidebar-folder-items">
            <Suspense fallback={<FolderListItemFallback />}>
              {folders.map((path, index) => (
                <div key={path} className="border-b border-border" data-testid={`sidebar-folder-item-${index}`}>
                  <FolderListItemSlot
                    path={path}
                    isSelected={selectedFolderPathsSet.has(path)}
                    isPrimary={primaryPath === path}
                    onRename={() => handleRename(path)}
                    onOpenInExplorer={() => void handleOpenInExplorer(path)}
                    onDelete={() => handleDeleteItem(path)}
                    onClick={(e) => handleFolderClick(path, e)}
                  />
                </div>
              ))}
            </Suspense>
          </div>
        )}
      </div>
    </div>
  )
}
