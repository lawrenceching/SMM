import { useCallback, useMemo } from "react"
import { useQueries } from "@tanstack/react-query"
import { useSidebarStore, compareByDisplayName } from "@/stores/sidebarStore"
import { Path } from "@smm/utils/path"
import { useUIMediaFolderStoreActions } from "@/stores/uiMediaFolderStore"
import { mediaMetadataReadQueryOptions } from "@/lib/mediaMetadataQueryKeys"
import { buildMediaFolderListItemPropsFromFolderAndMetadata } from "@/lib/sidebarRowUtils"
import { folderMatchesSearchQuery } from "@/lib/sidebarFolderSearch"
import { useDialogs } from "@/providers/dialog-provider"
import { useConfig } from "@/hooks/userConfig"
import { openInFileManagerApi } from "@/api/openInFileManager"
import { nextTraceId } from "@/lib/utils"
import { deleteMetadata } from "@/api/metadata"
import { useTranslation } from "@/lib/i18n"
import { isSmmV3Enabled } from "@/lib/localStorages"
import { useFoldersQuery, useUnimportFolderMutation } from "@/hooks/folders"
import { mergeFolderPathsWithUiStatus } from "@/lib/mergeFolderPathsWithUiStatus"
import { uniq } from "es-toolkit/array"

export interface UseSidebarOptions {
  onDeleteSelected?: (paths: string[]) => void
  /** Pure UI search query owned by Sidebar (filters the visible folder list). */
  searchQuery?: string
}

export function useSidebar({ onDeleteSelected, searchQuery = "" }: UseSidebarOptions = {}) {
  const { t } = useTranslation(["components"])
  const { sortOrder, filterType, setSortOrder, setFilterType } = useSidebarStore()
  const { removeFolder } = useUIMediaFolderStoreActions()
  const { userConfig, setAndSaveUserConfig } = useConfig()
  const folders = useMemo(() => {
    return uniq(userConfig.folders)
  }, [userConfig.folders])
  const unimportFolderMutation = useUnimportFolderMutation()
  const { renameFolderDialog } = useDialogs()
  const [openRenameForMediaFolder] = renameFolderDialog

  const foldersQuery = useFoldersQuery()
  const v3 = isSmmV3Enabled()
  const listFolders = v3
    ? mergeFolderPathsWithUiStatus(foldersQuery.data ?? [], folders)
    : folders

  const folderPaths = useMemo(() => listFolders.map((f) => f.path), [listFolders])

  const metadataQueries = useQueries({
    queries: folderPaths.map((path) => ({
      ...mediaMetadataReadQueryOptions(path),
      staleTime: 5 * 60 * 1000,
    })),
  })

  const rowsWithMeta = useMemo(() => {
    return listFolders.map((folder, i) =>
      buildMediaFolderListItemPropsFromFolderAndMetadata(folder, metadataQueries[i]?.data),
    )
  }, [listFolders, metadataQueries])

  const filteredAndSortedFolders = useMemo(() => {
    let result = [...rowsWithMeta]

    result = result.filter((folder) => folderMatchesSearchQuery(folder, searchQuery))

    if (filterType !== "all") {
      result = result.filter((folder) => folder.mediaType === filterType)
    }

    result.sort((a, b) => compareByDisplayName(a.mediaName, b.mediaName, sortOrder))

    return result.map((folder) => folder.path)
  }, [rowsWithMeta, sortOrder, filterType, searchQuery])

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
      if (isSmmV3Enabled()) {
        await unimportFolderMutation.mutateAsync(paths)
        return
      }
      if (onDeleteSelected) {
        await onDeleteSelected(paths)
        return
      }

      const traceId = `Sidebar-onDeleteSelected-${nextTraceId()}`
      const deletedSet = new Set(paths.map((p) => Path.posix(p)))

      await Promise.all(paths.map((path) => deleteMetadata(path)))

      setAndSaveUserConfig(traceId, {
        ...userConfig,
        folders: userConfig.folders.filter((folder) => !deletedSet.has(Path.posix(folder))),
      })
      paths.forEach((path) => removeFolder(path))
    },
    [onDeleteSelected, setAndSaveUserConfig, userConfig, removeFolder, unimportFolderMutation],
  )

  return {
    sortOrder,
    filterType,
    setSortOrder,
    setFilterType,
    filteredAndSortedFolders,
    handleRename,
    handleOpenInExplorer,
    handleDeletePaths,
  }
}
