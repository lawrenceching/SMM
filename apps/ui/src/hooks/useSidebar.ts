import { useCallback, useMemo } from "react"
import { useQueries } from "@tanstack/react-query"
import { useSidebarStore, compareByDisplayName } from "@/stores/sidebarStore"
import { basename } from "@/lib/path"
import { Path } from "@smm/utils/path"
import {
  useUIMediaFolderStoreActions,
  useUIMediaFolderSelection,
} from "@/stores/uiMediaFolderStore"
import { useMediaMetadataQuery } from "@/hooks/mediaMetadata/useMediaMetadataQuery"
import { mediaMetadataReadQueryOptions } from "@/lib/mediaMetadataQueryKeys"
import { buildMediaFolderListItemPropsFromFolderAndMetadata } from "@/lib/sidebarRowUtils"
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
}

export function useSidebar({ onDeleteSelected }: UseSidebarOptions = {}) {
  const { t } = useTranslation(["components"])
  const { sortOrder, filterType, searchQuery, setSortOrder, setFilterType, setSearchQuery } = useSidebarStore()
  const { applyFolderClick, selectAllFolderPaths, removeFolder } = useUIMediaFolderStoreActions()
  const { selectedFolder, selectedFolderPathsSet } = useUIMediaFolderSelection()
  const { userConfig, setAndSaveUserConfig } = useConfig()
  const folders = useMemo(() => {
    return uniq(userConfig.folders)
  }, [userConfig.folders])
  const unimportFolderMutation = useUnimportFolderMutation()
  const { renameFolderDialog } = useDialogs()
  const [openRenameForMediaFolder] = renameFolderDialog
  const { data: selectedMediaMetadata } = useMediaMetadataQuery(selectedFolder || undefined)
  const primarySelectedPath = selectedMediaMetadata?.mediaFolderPath ?? selectedFolder

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

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter((folder) => {
        const mediaNameMatch = folder.mediaName.toLowerCase().includes(query)
        const pathMatch = folder.path.toLowerCase().includes(query)
        const folderName = basename(folder.path) || ""
        const folderNameMatch = folderName.toLowerCase().includes(query)
        return mediaNameMatch || pathMatch || folderNameMatch
      })
    }

    if (filterType !== "all") {
      result = result.filter((folder) => folder.mediaType === filterType)
    }

    result.sort((a, b) => compareByDisplayName(a.mediaName, b.mediaName, sortOrder))

    return result
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

  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault()
        selectAllFolderPaths(filteredAndSortedFolders.map((f) => f.path))
      }
      if (e.key === "Delete" && selectedFolderPathsSet.size > 0) {
        e.preventDefault()
        void handleDeletePaths(Array.from(selectedFolderPathsSet))
      }
    },
    [handleDeletePaths, selectAllFolderPaths, filteredAndSortedFolders, selectedFolderPathsSet],
  )

  const handleDeleteItem = useCallback(
    (path: string) => {
      const posix = Path.posix(path)
      const selectedPaths = Array.from(selectedFolderPathsSet)
      const shouldDeleteSelection =
        selectedPaths.length > 0 && selectedPaths.some((p) => Path.posix(p) === posix)
      const paths = shouldDeleteSelection ? selectedPaths : [path]
      void handleDeletePaths(paths)
    },
    [handleDeletePaths, selectedFolderPathsSet],
  )

  return {
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
  }
}
