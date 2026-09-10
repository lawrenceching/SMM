import { useCallback, useMemo, useState } from "react"
import { useQueries } from "@tanstack/react-query"
import { basename } from '../lib/path'
import { mediaMetadataReadQueryOptions } from "@/lib/mediaMetadataQueryKeys"
import { mediaTypeFromMetadataType } from "@/lib/sidebarRowUtils"
import { compareByDisplayName, type SortOrder, type FilterType } from "@/lib/sidebarSort"
import { openInFileManagerApi } from "@/api/openInFileManager"
import { useFoldersQuery, useUnimportFolderMutation } from "@/hooks/folders"
import { Path } from "@smm/utils/path"
import { useUIMediaFolderStoreState } from "@/stores/uiMediaFolderStore"
import { mergeFolderListPaths } from "@/lib/mergeFolderListPaths"

export interface UseSidebarOptions {
  onDeleteSelected?: (paths: string[]) => void
  /** Pure UI search query owned by Sidebar (filters the visible folder list). */
  searchQuery?: string
}

export function useSidebar({ searchQuery = "" }: UseSidebarOptions = {}) {
  // Sort/filter are pure UI state owned by this hook's single consumer (Sidebar).
  // Kept local via useState instead of a global store: no cross-component sharing.
  const [sortOrder, setSortOrder] = useState<SortOrder>("none")
  const [filterType, setFilterType] = useState<FilterType>("all")

  const unimportFolderMutation = useUnimportFolderMutation()
  const { folders: storeFolders } = useUIMediaFolderStoreState()

  const foldersQuery = useFoldersQuery();

  const folderPaths = useMemo(
    () => mergeFolderListPaths(
      foldersQuery.data,
      storeFolders.map((folder) => folder.path),
    ),
    [foldersQuery.data, storeFolders],
  )

  const metadataQueries = useQueries({
    queries: folderPaths.map((folderAbsPath) => ({
      ...mediaMetadataReadQueryOptions(folderAbsPath)
    })),
  })

  const folders = useMemo(() => {

    let folderSearchFields = folderPaths.map((folderAbsPath) => {

      const m = metadataQueries.find((query) => query.data?.mediaFolderPath === Path.posix(folderAbsPath))?.data

      return {
        folderName: basename(folderAbsPath) ?? '',
        type: m?.type,
        path: folderAbsPath
      }
    })

    folderSearchFields = folderSearchFields.filter((folder) => (folder.folderName.toLocaleLowerCase() ?? '').includes(searchQuery.toLowerCase()))
    
    if (filterType !== "all") {
      folderSearchFields = folderSearchFields.filter((folder) => mediaTypeFromMetadataType(folder.type) === filterType)
    }

    if (sortOrder !== "none") {
      folderSearchFields.sort((a, b) => compareByDisplayName(a.folderName, b.folderName, sortOrder))
    }

    return folderSearchFields.map((folder) => folder.path)
  }, [folderPaths, metadataQueries, sortOrder, filterType, searchQuery])
  
  const handleOpenInExplorer = useCallback(async (path: string) => {
    try {
      const result = await openInFileManagerApi(path)
      if (result.error) {
        console.error("[OpenInFileManager] Error:", result.error)
      }
    } catch (error) {
      console.error("[OpenInFileManager] Failed to open folder:", error)
    }
  }, [])

  const handleDeletePaths = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0) return
      await unimportFolderMutation.mutateAsync(paths)
    },
    [unimportFolderMutation],
  )

  return {
    sortOrder,
    filterType,
    setSortOrder,
    setFilterType,
    folders,
    handleOpenInExplorer,
    handleDeletePaths,
  }
}
