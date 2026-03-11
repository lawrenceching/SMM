import { create } from "zustand"

export type SortOrder = "alphabetical" | "reverse-alphabetical"
export type FilterType = "all" | "tvshow" | "movie" | "music"

interface SidebarStoreState {
  sortOrder: SortOrder
  filterType: FilterType
  searchQuery: string
}

interface SidebarStoreActions {
  setSortOrder: (order: SortOrder) => void
  setFilterType: (type: FilterType) => void
  setSearchQuery: (query: string) => void
}

type SidebarStore = SidebarStoreState & SidebarStoreActions

const useSidebarStore = create<SidebarStore>((set) => ({
  sortOrder: "alphabetical",
  filterType: "all",
  searchQuery: "",

  setSortOrder: (order) => set({ sortOrder: order }),
  setFilterType: (type) => set({ filterType: type }),
  setSearchQuery: (query) => set({ searchQuery: query }),
}))

/**
 * Compare two display names using the same logic as Sidebar list sort.
 * Used by AppV2 (filteredAndSortedFolders) and MediaLibraryImportedEventHandler (init order).
 */
export function compareByDisplayName(
  nameA: string,
  nameB: string,
  sortOrder: SortOrder
): number {
  const comparison = nameA.localeCompare(nameB, undefined, { sensitivity: "base" })
  return sortOrder === "alphabetical" ? comparison : -comparison
}

/**
 * Sort paths by Sidebar display order (by display name, using current sortOrder from store).
 * Use this when the order of operations must match what the user sees in the Sidebar.
 */
export function sortPathsBySidebarDisplayOrder(
  paths: string[],
  getDisplayName: (path: string) => string
): string[] {
  const sortOrder = useSidebarStore.getState().sortOrder
  return [...paths].sort((a, b) =>
    compareByDisplayName(getDisplayName(a), getDisplayName(b), sortOrder)
  )
}

export { useSidebarStore }
