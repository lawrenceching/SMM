import { useCallback, useMemo } from "react"
import { basename, dirname, join } from "@/lib/path"
import { cn } from "@/lib/utils"
import { Path } from "@core/path"
import type { UserConfig } from "@core/types"
import { useMediaMetadata } from "@/providers/media-metadata-provider"
import { useConfig } from "@/providers/config-provider"
import { useDialogs } from "@/providers/dialog-provider"
import { openInFileManagerApi } from "@/api/openInFileManager"
import { renameFolder } from "@/api/renameFolder"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { useTranslation } from "@/lib/i18n"

export interface MediaFolderListItemV2Props {
  mediaName: string,
  /**
   * Absolute path of the media folder, in POSIX format
   */
  path: string,
  /**
   * Click handler for the folder item
   */
  onClick?: () => void
}

export function MediaFolderListItemV2({mediaName, path, onClick}: MediaFolderListItemV2Props) {
  const { t } = useTranslation(['components', 'dialogs'])

  const {
    removeMediaMetadata,
    updateMediaMetadata,
    getMediaMetadata,
    refreshMediaMetadata,
    selectedMediaMetadata } = useMediaMetadata()
  const { userConfig, setUserConfig } = useConfig()
  const { renameDialog } = useDialogs()
  const [openRename] = renameDialog
  const selected = useMemo(() => {
    return selectedMediaMetadata?.mediaFolderPath === path
  }, [selectedMediaMetadata, path])

  const folderName = useMemo(() => {
    return basename(path)
  }, [path])

  const handleDeleteButtonClick = useCallback(() => {
    removeMediaMetadata(path)

    const newUserConfig: UserConfig = {
      ...userConfig,
      folders: userConfig.folders.filter((folder) => Path.posix(folder) !== path),
    }

    setUserConfig(newUserConfig)
  }, [path, userConfig, setUserConfig, removeMediaMetadata])

  const handleOpenInExplorerButtonClick = useCallback(async () => {
    try {
      const result = await openInFileManagerApi(path);
      if (result.error) {
        console.error('[OpenInFileManager] Error:', result.error);
        // You might want to show a toast notification here
      }
    } catch (error) {
      console.error('[OpenInFileManager] Failed to open folder:', error);
      // You might want to show a toast notification here
    }
  }, [path])

  const handleRenameButtonClick = useCallback(() => {
    const currentMetadata = getMediaMetadata(path)
    if (!currentMetadata) {
      console.error('Media metadata not found for path:', path)
      return
    }

    // Build suggestion string if tmdbTvShow exists
    const suggestions: string[] = []
    if (currentMetadata.tmdbTvShow) {
      const tvShow = currentMetadata.tmdbTvShow
      const year = tvShow.first_air_date ? tvShow.first_air_date.split('-')[0] : ''
      const suggestion = `${tvShow.name}${year ? ` (${year})` : ''} {tmdbid=${tvShow.id}}`
      suggestions.push(suggestion)
    }

    openRename(
      async (newName: string) => {
        try {
          // Calculate the new folder path
          const parentDir = dirname(path)
          const newFolderPath = join(parentDir, newName)
          
          // Call renameFolder API to rename the folder on disk
          await renameFolder({
            from: path,
            to: newFolderPath,
          })

          // Update the metadata with the new name and path
          const updatedMetadata: typeof currentMetadata = { 
            ...currentMetadata,
            mediaFolderPath: newFolderPath
          }
          
          // Update based on media type
          if (updatedMetadata.tmdbTvShow) {
            updatedMetadata.tmdbTvShow = {
              ...updatedMetadata.tmdbTvShow,
              name: newName
            }
          } else if (updatedMetadata.tmdbMovie) {
            updatedMetadata.tmdbMovie = {
              ...updatedMetadata.tmdbMovie,
              title: newName
            }
          } else {
            // Fallback to deprecated mediaName field if no TMDB data exists
            updatedMetadata.mediaName = newName
          }

          // Update user config to reflect the new folder path
          const newUserConfig: UserConfig = {
            ...userConfig,
            folders: userConfig.folders.map((folder) => 
              Path.posix(folder) === path ? newFolderPath : folder
            ),
          }
          setUserConfig(newUserConfig)

          // Remove old metadata entry if path changed
          if (path !== newFolderPath) {
            removeMediaMetadata(path)
          }

          // Update media metadata with new path
          updateMediaMetadata(newFolderPath, updatedMetadata)

          // Refresh media metadata to reflect the rename
          await refreshMediaMetadata(newFolderPath)

          console.log("Folder renamed successfully:", path, "->", newFolderPath)
        } catch (error) {
          console.error("Failed to rename folder:", error)
          // You might want to show a toast notification here
        }
      },
      {
        initialValue: mediaName,
        title: t('mediaFolder.renameTitle'),
        description: t('mediaFolder.renameDescription'),
        suggestions: suggestions.length > 0 ? suggestions : undefined
      }
    )
  }, [path, mediaName, getMediaMetadata, openRename, updateMediaMetadata, removeMediaMetadata, refreshMediaMetadata, userConfig, setUserConfig])

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            "group relative flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all duration-200 ease-out",
            selected
              ? "bg-white border-l-4 border-l-sidebar-primary"
              : "bg-white hover:bg-gray-100"
          )}
          onClick={onClick}
        >
          {/* Content */}
          <div className="flex-1 min-w-0">
            <h5 className={cn(
              "text-sm font-medium truncate",
              selected ? "text-sidebar-foreground font-bold" : "text-sidebar-foreground/80 hover:text-sidebar-foreground"
            )}>
              {mediaName}
            </h5>
            <p className={cn(
              "text-xs truncate mt-0.5",
              selected ? "text-sidebar-foreground/60" : "text-sidebar-foreground/50 hover:sidebar-foreground/60"
            )}>
              {folderName}
            </p>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={handleRenameButtonClick}>{t('mediaFolder.rename')}</ContextMenuItem>
        <ContextMenuItem onClick={handleOpenInExplorerButtonClick}>{t('mediaFolder.openInExplorer')}</ContextMenuItem>
        <ContextMenuItem onClick={handleDeleteButtonClick}>
          <div className="flex items-center gap-4">
            <span>{t('mediaFolder.delete')}</span>
            <span className="text-xs text-muted-foreground">{t('mediaFolder.deleteWarning')}</span>
          </div>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

