import { useMemo } from "react"
import { basename } from "@/lib/path"
import { cn } from "@/lib/utils"
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
  onRename?: () => void
  onOpenInExplorer?: () => void
  onDelete?: () => void
  /**
   * Status of the media metadata initialization
   */
  status?: 'idle' | 'initializing' | 'ok' | 'folder_not_found' | 'loading'
}

export function MediaFolderListItemV2({
  mediaName,
  path,
  onClick,
  isSelected = false,
  isPrimary = false,
  onRename,
  onOpenInExplorer,
  onDelete,
  status,
}: MediaFolderListItemV2Props) {
  const { t } = useTranslation(['components', 'dialogs'])
  const selected = isSelected

  const folderName = useMemo(() => {
    return basename(path)
  }, [path])

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
              data-testid="sidebar-folder-title"
            >
              {mediaName}
            </h5>
            <p className={cn(
              "text-xs truncate mt-0.5",
              selected ? "text-sidebar-foreground/60" : "text-sidebar-foreground/50 hover:text-sidebar-foreground/60"
            )}
              data-testid="sidebar-folder-name"
            >
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
        <ContextMenuItem onClick={onRename} data-testid="context-menu-rename">{t('mediaFolder.rename')}</ContextMenuItem>
        <ContextMenuItem onClick={onOpenInExplorer} data-testid="context-menu-open-in-explorer">{t('mediaFolder.openInExplorer')}</ContextMenuItem>
        <ContextMenuItem onClick={onDelete} data-testid="context-menu-delete">
          <div className="flex items-center gap-4">
            <span>{t('mediaFolder.delete')}</span>
            <span className="text-xs text-muted-foreground">{t('mediaFolder.deleteWarning')}</span>
          </div>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
