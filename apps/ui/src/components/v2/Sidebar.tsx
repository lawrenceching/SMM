import { useCallback, useMemo } from "react"
import { useQueries } from "@tanstack/react-query"
import { SearchForm } from "@/components/search-form"
import { MediaFolderToolbar, type SortOrder, type FilterType } from "@/components/shared/MediaFolderToolbar"
import { MediaFolderListItemV2 } from "../sidebar/MediaFolderListItemV2"
import { useSidebarStore, compareByDisplayName } from "@/stores/sidebarStore"
import { basename } from "@/lib/path"
import { Path } from "@core/path"
import {
  useUIMediaFolderStoreState,
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
import { mediaMetadataRepository } from "@/api/mediaMetadataRepository"
import { useTranslation } from "@/lib/i18n"

export type { SortOrder, FilterType }

export interface SidebarProps {
  onDeleteSelected?: (paths: string[]) => void
}

export function Sidebar({ onDeleteSelected }: SidebarProps) {
  const { t } = useTranslation(["components"])
  const { sortOrder, filterType, searchQuery, setSortOrder, setFilterType, setSearchQuery } = useSidebarStore()
  const { folders } = useUIMediaFolderStoreState()
  const { applyFolderClick, selectAllFolderPaths, removeFolder } = useUIMediaFolderStoreActions()
  const { selectedFolder, selectedFolderPathsSet } = useUIMediaFolderSelection()
  const { userConfig, setAndSaveUserConfig } = useConfig()
  const { renameFolderDialog } = useDialogs()
  const [openRenameForMediaFolder] = renameFolderDialog
  const { data: selectedMediaMetadata } = useMediaMetadataQuery(selectedFolder || undefined)
  const primarySelectedPath = selectedMediaMetadata?.mediaFolderPath ?? selectedFolder

  const folderPaths = useMemo(() => folders.map((f) => f.path), [folders])

  const metadataQueries = useQueries({
    queries: folderPaths.map((path) => ({
      ...mediaMetadataReadQueryOptions(path),
      staleTime: 5 * 60 * 1000,
    })),
  })

  const rowsWithMeta = useMemo(() => {
    return folders.map((folder, i) =>
      buildMediaFolderListItemPropsFromFolderAndMetadata(folder, metadataQueries[i]?.data),
    )
  }, [folders, metadataQueries])

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

  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault()
        selectAllFolderPaths(filteredAndSortedFolders.map((f) => f.path))
      }
      if (e.key === "Delete" && selectedFolderPathsSet.size > 0 && onDeleteSelected) {
        e.preventDefault()
        onDeleteSelected(Array.from(selectedFolderPathsSet))
      }
    },
    [onDeleteSelected, selectAllFolderPaths, filteredAndSortedFolders, selectedFolderPathsSet],
  )

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
      if (onDeleteSelected) {
        await onDeleteSelected(paths)
        return
      }

      const traceId = `Sidebar-onDeleteSelected-${nextTraceId()}`
      const deletedSet = new Set(paths.map((p) => Path.posix(p)))

      await Promise.all(paths.map((path) => mediaMetadataRepository.delete(path, { traceId })))

      setAndSaveUserConfig(traceId, {
        ...userConfig,
        folders: userConfig.folders.filter((folder) => !deletedSet.has(Path.posix(folder))),
      })
      paths.forEach((path) => removeFolder(path))
    },
    [onDeleteSelected, setAndSaveUserConfig, userConfig, removeFolder],
  )

  const handleDeleteItem = useCallback(
    (path: string) => {
      const shouldDeleteSelection =
        selectedFolderPathsSet.size > 0 && selectedFolderPathsSet.has(path)
      const paths = shouldDeleteSelection ? Array.from(selectedFolderPathsSet) : [path]
      void handleDeletePaths(paths)
    },
    [handleDeletePaths, selectedFolderPathsSet],
  )

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
          placeholder="搜索媒体文件夹..."
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
            没有找到媒体文件夹
          </div>
        ) : (
          <div className="flex flex-col outline-none" data-testid="sidebar-folder-items">
            {filteredAndSortedFolders.map((folder, index) => (
              <div key={folder.path} className="border-b border-border" data-testid={`sidebar-folder-item-${index}`}>
                <MediaFolderListItemV2
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
