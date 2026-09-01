import { useCallback, useMemo } from "react"
import { useQueries } from "@tanstack/react-query"
import { useSidebarStore, compareByDisplayName } from "@/stores/sidebarStore"
import { basename } from '../lib/path'
import {
  useUIMediaFolderStoreState,
} from "@/stores/uiMediaFolderStore"
import { mediaMetadataReadQueryOptions } from "@/lib/mediaMetadataQueryKeys"
import { buildMediaFolderListItemPropsFromFolderAndMetadata, mediaTypeFromMetadataType } from "@/lib/sidebarRowUtils"
import { folderMatchesSearchQuery } from "@/lib/sidebarFolderSearch"
import { useDialogs } from "@/providers/dialog-provider"
import { openInFileManagerApi } from "@/api/openInFileManager"
import { useTranslation } from "@/lib/i18n"
import { useFoldersQuery, useUnimportFolderMutation } from "@/hooks/folders"
import { mergeFolderPathsWithUiStatus } from "@/lib/mergeFolderPathsWithUiStatus"
import { Path } from "@smm/utils/path"

export interface UseSidebarOptions {
  onDeleteSelected?: (paths: string[]) => void
  /** Pure UI search query owned by Sidebar (filters the visible folder list). */
  searchQuery?: string
}

export function useSidebar({ searchQuery = "" }: UseSidebarOptions = {}) {
  const { t } = useTranslation(["components"])
  const { sortOrder, filterType, setSortOrder, setFilterType } = useSidebarStore()
  const { _folders } = useUIMediaFolderStoreState()

  const unimportFolderMutation = useUnimportFolderMutation()
  const { renameFolderDialog } = useDialogs()
  const [openRenameForMediaFolder] = renameFolderDialog

  const foldersQuery = useFoldersQuery();

  const metadataQueries = useQueries({
    queries: (foldersQuery.data ?? []).map((folderAbsPath) => ({
      ...mediaMetadataReadQueryOptions(folderAbsPath)
    })),
  })

  const folders = useMemo(() => {

    let folderSearchFields = (foldersQuery.data ?? []).map((folderAbsPath) => {

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
  }, [foldersQuery.data, metadataQueries, sortOrder, filterType, searchQuery])
  
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

  const handleRename = useCallback(
    (path: string) => {
      openRenameForMediaFolder(path, {
        title: t("mediaFolder.renameTitle"),
        description: t("mediaFolder.renameDescription"),
      })
    },
    [openRenameForMediaFolder, t],
  )

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
    handleRename,
    handleOpenInExplorer,
    handleDeletePaths,
  }
}
