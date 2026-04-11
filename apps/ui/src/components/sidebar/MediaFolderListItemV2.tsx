import { useCallback, useMemo } from "react"
import { basename } from "@/lib/path"
import { cn, nextTraceId } from "@/lib/utils"
import { Path } from "@core/path"
import type { UserConfig } from "@core/types"
import { useMediaMetadataStoreState } from "@/stores/mediaMetadataStore"
import { useMediaMetadataActions } from "@/actions/mediaMetadataActions"
import { useConfig } from "@/hooks/userConfig"
import { useDialogs } from "@/providers/dialog-provider"
import { openInFileManagerApi } from "@/api/openInFileManager"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Loader2 } from "lucide-react"
import { useTranslation } from "@/lib/i18n"

export interface MediaFolderListItemV2Props {
  mediaName: string,
  mediaType: "tvshow" | "movie" | "music",
  /**
   * Absolute path of the media folder, in POSIX format
   */
  path: string,
  /**
   * Click handler for the folder item (receives event for modifier keys)
   */
  onClick?: (e: React.MouseEvent) => void
  /**
   * When provided (multi-select), overrides internal selected state for styling
   */
  isSelected?: boolean
  /**
   * When true, item is the primary selection (e.g. stronger highlight)
   */
  isPrimary?: boolean
  /**
   * When provided with onDeleteSelected, context menu Delete removes all selected folders
   */
  selectedFolderPaths?: Set<string>
  /**
   * When provided, context menu Delete calls this with paths to delete (e.g. all selected)
   */
  onDeleteSelected?: (paths: string[]) => void
  /**
   * Status of the media metadata initialization
   */
  status?: 'idle' | 'initializing' | 'ok' | 'folder_not_found' | 'loading'
}

export function MediaFolderListItemV2({
  mediaName,
  path,
  onClick,
  isSelected: isSelectedProp,
  isPrimary = false,
  selectedFolderPaths: selectedFolderPathsProp,
  onDeleteSelected,
  status,
}: MediaFolderListItemV2Props) {
  const { t } = useTranslation(['components', 'dialogs'])

  const { selectedMediaMetadata } = useMediaMetadataStoreState()
  const { deleteMediaMetadata } = useMediaMetadataActions()
  const { userConfig, setAndSaveUserConfig } = useConfig()
  const { renameDialog } = useDialogs()
  const [, , openRenameForMediaFolder] = renameDialog
  const selectedFromProvider = useMemo(
    () => selectedMediaMetadata?.mediaFolderPath === path,
    [selectedMediaMetadata, path]
  )
  const selected =
    isSelectedProp !== undefined ? isSelectedProp : selectedFromProvider

  const folderName = useMemo(() => {
    return basename(path)
  }, [path])

  const handleDeleteButtonClick = useCallback(async () => {
    const traceId = `MediaFolderListItemV2-${nextTraceId()}`;
    console.log(`[${traceId}] MediaFolderListItemV2: Removing folder ${path}`)

    try {
      await deleteMediaMetadata(path, { traceId });
    } catch (error) {
      console.error(`[${traceId}] Failed to delete media metadata:`, error);
    }

    const newUserConfig: UserConfig = {
      ...userConfig,
      folders: userConfig.folders.filter((folder) => Path.posix(folder) !== path),
    }

    setAndSaveUserConfig(traceId, newUserConfig)
  }, [path, userConfig, setAndSaveUserConfig, deleteMediaMetadata])

  const handleDeleteClick = useCallback(() => {
    if (onDeleteSelected && selectedFolderPathsProp && selectedFolderPathsProp.size > 0) {
      onDeleteSelected(Array.from(selectedFolderPathsProp))
    } else {
      handleDeleteButtonClick()
    }
  }, [onDeleteSelected, selectedFolderPathsProp, handleDeleteButtonClick])

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
    openRenameForMediaFolder(path, {
      title: t('mediaFolder.renameTitle'),
      description: t('mediaFolder.renameDescription'),
    })
  }, [path, openRenameForMediaFolder, t])

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            "group relative flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all duration-200 ease-out",
            selected &&
              (isPrimary
                ? "border-l-4 border-l-primary bg-primary/5"
                : "border-l-4 border-l-sidebar-primary bg-sidebar-accent"),
            !selected && "bg-sidebar hover:bg-sidebar-accent/80"
          )}
          onClick={onClick}
        >
          {/* Content */}
          <div className="flex-1 min-w-0">
            <h5
              className={cn(
                "text-sm font-medium truncate",
                selected ? "text-sidebar-foreground font-bold" : "text-sidebar-foreground/80 hover:text-sidebar-foreground"
              )}
              data-testid="sidebar-folder-name"
            >
              {mediaName}
            </h5>
            <p className={cn(
              "text-xs truncate mt-0.5",
              selected ? "text-sidebar-foreground/60" : "text-sidebar-foreground/50 hover:text-sidebar-foreground/60"
            )}>
              {folderName}
            </p>
          </div>
          {/* Status indicator */}
          {(status === 'initializing' || status === 'loading') && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent data-testid="folder-context-menu">
        <ContextMenuItem onClick={handleRenameButtonClick} data-testid="context-menu-rename">{t('mediaFolder.rename')}</ContextMenuItem>
        <ContextMenuItem onClick={handleOpenInExplorerButtonClick} data-testid="context-menu-open-in-explorer">{t('mediaFolder.openInExplorer')}</ContextMenuItem>
        <ContextMenuItem onClick={handleDeleteClick} data-testid="context-menu-delete">
          <div className="flex items-center gap-4">
            <span>{t('mediaFolder.delete')}</span>
            <span className="text-xs text-muted-foreground">{t('mediaFolder.deleteWarning')}</span>
          </div>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
