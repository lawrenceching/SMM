import { create } from "zustand"

export type SortOrder = "none" | "alphabetical" | "reverse-alphabetical"
export type FilterType = "all" | "tvshow" | "movie" | "music"

interface SidebarStoreState {
  sortOrder: SortOrder
  filterType: FilterType
}

interface SidebarStoreActions {
  setSortOrder: (order: SortOrder) => void
  setFilterType: (type: FilterType) => void
}

type SidebarStore = SidebarStoreState & SidebarStoreActions

const useSidebarStore = create<SidebarStore>((set) => ({
  sortOrder: "none",
  filterType: "all",

  setSortOrder: (order) => set({ sortOrder: order }),
  setFilterType: (type) => set({ filterType: type }),
}))

/**
 * Compare two display names using the same logic as Sidebar list sort.
 * Used by AppV2 (folders) and MediaLibraryImportedEventHandler (init order).
 * Returns 0 when sortOrder is "none" (callers should skip .sort() for original order).
 */
export function compareByDisplayName(
  nameA: string,
  nameB: string,
  sortOrder: SortOrder
): number {
  if (sortOrder === "none") return 0
  const comparison = nameA.localeCompare(nameB, undefined, { sensitivity: "base" })
  return sortOrder === "alphabetical" ? comparison : -comparison
}

/**
 * Sort paths by Sidebar display order (by display name, using current sortOrder from store).
 * Use this when the order of operations must match what the user sees in the Sidebar.
 * When sortOrder is "none", returns paths in the given order (no reordering).
 */
export function sortPathsBySidebarDisplayOrder(
  paths: string[],
  getDisplayName: (path: string) => string
): string[] {
  const sortOrder = useSidebarStore.getState().sortOrder
  if (sortOrder === "none") return [...paths]
  return [...paths].sort((a, b) =>
    compareByDisplayName(getDisplayName(a), getDisplayName(b), sortOrder)
  )
}

export { useSidebarStore }
