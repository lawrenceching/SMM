import { useCallback, useMemo } from "react"
import { basename, dirname, join } from "@/lib/path"
import { cn, nextTraceId } from "@/lib/utils"
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

export interface MediaFolderListItemProps {
  mediaName: string,
  /**
   * Absolute path of the media folder, in POSIX format
   */
  path: string,
  mediaType: 'tvshow' | 'movie' | 'music'

  /**
   * could be base64 encoded image data (data:image/svg+xml;base64,... or data:image/svg+xml;base64,...), file path (file://), web URL (https://)
   */
  icon?: string
  /**
   * Click handler for the folder item
   */
  onClick?: () => void
}

export function MediaFolderListItem({mediaName, path, mediaType, onClick}: MediaFolderListItemProps) {

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

  const fallbackThumbnail = useMemo(() => {
    switch (mediaType) {
      case 'tvshow': {
        // TV show icon - purple/blue gradient with play icon
        const svg = `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" fill="#F0F0F0"/>
          <path d="M16 8H24L28 12H48V48H16V8Z" fill="url(#tvGradient)"/>
          <path d="M20 16H44V20H20V16Z" fill="#9333EA"/>
          <circle cx="32" cy="32" r="8" fill="white" opacity="0.9"/>
          <path d="M28 30L32 32L28 34V30Z" fill="#9333EA"/>
          <defs>
            <linearGradient id="tvGradient" x1="16" y1="8" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop stop-color="#9333EA"/>
              <stop offset="1" stop-color="#3B82F6"/>
            </linearGradient>
          </defs>
        </svg>`
        return `data:image/svg+xml;base64,${btoa(svg)}`
      }
      case 'movie': {
        // Movie icon - red/orange gradient with film strip
        const svg = `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" fill="#F0F0F0"/>
          <path d="M16 8H24L28 12H48V48H16V8Z" fill="url(#movieGradient)"/>
          <rect x="20" y="16" width="24" height="32" fill="white" opacity="0.2"/>
          <rect x="20" y="20" width="4" height="24" fill="white" opacity="0.3"/>
          <rect x="40" y="20" width="4" height="24" fill="white" opacity="0.3"/>
          <circle cx="32" cy="32" r="6" fill="white" opacity="0.9"/>
          <path d="M29 30L32 32L29 34V30Z" fill="#DC2626"/>
          <defs>
            <linearGradient id="movieGradient" x1="16" y1="8" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop stop-color="#DC2626"/>
              <stop offset="1" stop-color="#F97316"/>
            </linearGradient>
          </defs>
        </svg>`
        return `data:image/svg+xml;base64,${btoa(svg)}`
      }
      case 'music': {
        // Music icon - purple/pink gradient with music note
        const svg = `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" fill="#F0F0F0"/>
          <path d="M16 8H24L28 12H48V48H16V8Z" fill="url(#musicGradient)"/>
          <path d="M20 16H44V20H20V16Z" fill="#A855F7"/>
          <path d="M28 24C28 22.8954 28.8954 22 30 22H34C35.1046 22 36 22.8954 36 24V36C36 37.1046 35.1046 38 34 38H30C28.8954 38 28 37.1046 28 36V24Z" fill="white" opacity="0.9"/>
          <path d="M36 28L40 26V34L36 32V28Z" fill="white" opacity="0.9"/>
          <circle cx="30" cy="24" r="1.5" fill="#A855F7"/>
          <circle cx="34" cy="24" r="1.5" fill="#A855F7"/>
          <defs>
            <linearGradient id="musicGradient" x1="16" y1="8" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop stop-color="#A855F7"/>
              <stop offset="1" stop-color="#EC4899"/>
            </linearGradient>
          </defs>
        </svg>`
        return `data:image/svg+xml;base64,${btoa(svg)}`
      }
      default: {
        // Default folder icon - orange/yellow gradient
        const svg = `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" fill="#F0F0F0"/>
          <path d="M16 8H24L28 12H48V48H16V8Z" fill="#FFC700"/>
          <path d="M20 16H44V20H20V16Z" fill="#FFC700"/>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" x="20" y="20">
            <path d="M10 4H4V20H10V4Z" fill="white"/>
            <path d="M12 6H18V18H12V6Z" fill="white"/>
          </svg>
        </svg>`
        return `data:image/svg+xml;base64,${btoa(svg)}`
      }
    }
  }, [mediaType])

  const folderName = useMemo(() => {
    return basename(path)
  }, [path])

  const handleDeleteButtonClick = useCallback(() => {
    const traceId = `MediaFolderListItem-${nextTraceId()}`;
    console.log(`[${traceId}] MediaFolderListItem: Removing folder ${path}`)

    removeMediaMetadata(path)

    const newUserConfig: UserConfig = {
      ...userConfig,
      folders: userConfig.folders.filter((folder) => Path.posix(folder) !== path),
    }

    setUserConfig(traceId, newUserConfig)
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
        const traceId = `MediaFolderListItem-${nextTraceId()}`;
        console.log(`[${traceId}] MediaFolderListItem: Renaming folder ${path} to ${newName}`)

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
          setUserConfig(traceId, newUserConfig)

          // Remove old metadata entry if path changed
          if (path !== newFolderPath) {
            removeMediaMetadata(path)
          }

          // Update media metadata with new path
          updateMediaMetadata(newFolderPath, updatedMetadata, { traceId })

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
        title: "Rename Media",
        description: "Enter the new name for this media",
        suggestions: suggestions.length > 0 ? suggestions : undefined
      }
    )
  }, [path, mediaName, getMediaMetadata, openRename, updateMediaMetadata, removeMediaMetadata, refreshMediaMetadata, userConfig, setUserConfig])

  return (
    <div 
      className={cn(
        "flex flex-col gap-2 p-2 rounded-md hover:bg-primary/10 cursor-pointer",
        selected && "bg-primary/30"
      )}
      onClick={onClick}
    >
      <ContextMenu>
        <ContextMenuTrigger>
          <div className="flex items-center gap-2">
            <img src={fallbackThumbnail} alt={mediaName} className="w-10 h-10 rounded-md" />
            <div className="flex-1 min-w-0">
              <h5 className="text-sm font-bold truncate">{mediaName}</h5>
              <p className="text-xs text-muted-foreground truncate">{folderName}</p>
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={handleRenameButtonClick}>Rename</ContextMenuItem>
          <ContextMenuItem onClick={handleOpenInExplorerButtonClick}>Open in Explorer</ContextMenuItem>
          <ContextMenuItem onClick={handleDeleteButtonClick}>
            <div className="flex items-center gap-4">
              <span>Delete</span>
              <span className="text-xs text-muted-foreground">will NOT delete from disk</span>
            </div>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  )
}

