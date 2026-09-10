import { basename } from "@/lib/path"

export interface FolderSearchFields {
  mediaName: string
  path: string
}

/** Whether a folder row matches the sidebar search box (pure UI filter). */
export function folderMatchesSearchQuery(
  folder: FolderSearchFields,
  searchQuery: string,
): boolean {
  if (!searchQuery.trim()) return true
  const query = searchQuery.toLowerCase().trim()
  const mediaNameMatch = folder.mediaName.toLowerCase().includes(query)
  const pathMatch = folder.path.toLowerCase().includes(query)
  const folderName = basename(folder.path) || ""
  const folderNameMatch = folderName.toLowerCase().includes(query)
  return mediaNameMatch || pathMatch || folderNameMatch
}
