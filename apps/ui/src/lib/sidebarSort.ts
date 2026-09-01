export type SortOrder = "none" | "alphabetical" | "reverse-alphabetical"
export type FilterType = "all" | "tvshow" | "movie" | "music"

/**
 * Compare two display names using the same logic as Sidebar list sort.
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
