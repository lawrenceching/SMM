import { XCircle } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { useDialogs } from "@/providers/dialog-provider"
import { useMediaMetadata } from "@/providers/media-metadata-provider"
import { relative, join } from "@/lib/path"
import { renameFile } from "@/api/renameFile"
import { toast } from "sonner"
import type { FileProps } from "@/lib/types"
import { useTranslation } from "@/lib/i18n"

interface EpisodeFileProps {
    file: FileProps
    icon: LucideIcon
    label?: string
    iconColor?: string
    isPreviewingForRename: boolean
    /** True when user is reviewing match between local video file and episode; UI highlights the video file path. */
    isPreviewingForRecognize?: boolean
    showRenameMenu?: boolean
    /**
     * Callback when "Select File" is clicked from context menu
     */
    onFileSelectButtonClick?: (file: FileProps) => void
}

// Helper function to get relative path from media folder
function getRelativePath(mediaFolderPath: string | undefined, filePath: string): string {
    if (!mediaFolderPath) {
        // Fallback to filename if media folder path is not available
        const parts = filePath.split(/[/\\]/)
        return parts[parts.length - 1] || filePath
    }
    
    try {
        return relative(mediaFolderPath, filePath)
    } catch (error) {
        // If relative path calculation fails, fallback to filename
        const parts = filePath.split(/[/\\]/)
        return parts[parts.length - 1] || filePath
    }
}

export function EpisodeFile({
    file,
    icon: Icon,
    iconColor = "text-muted-foreground",
    isPreviewingForRename,
    isPreviewingForRecognize = false,
    showRenameMenu = false,
    onFileSelectButtonClick,
}: EpisodeFileProps) {
    const { t } = useTranslation(['components', 'dialogs'])
    const { selectedMediaMetadata, refreshMediaMetadata } = useMediaMetadata()
    const { renameDialog } = useDialogs()

    const mediaFolderPath = selectedMediaMetadata?.mediaFolderPath
    const relativePath = getRelativePath(mediaFolderPath, file.path)
    const newRelativePath = file.newPath ? getRelativePath(mediaFolderPath, file.newPath) : null
    const hasPreview = isPreviewingForRename && file.newPath
    const isDeleted = file.isDeleted ?? false
    const highlightPath = isPreviewingForRecognize && !hasPreview
    
    // Debug logging
    if (!relativePath || relativePath === file.path) {
      console.log('[EpisodeFile] Path calculation issue:', {
        filePath: file.path,
        mediaFolderPath,
        relativePath,
        calculated: getRelativePath(mediaFolderPath, file.path)
      })
    }

    const fileContent = (
        <div className={cn(
            "group relative flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors",
            hasPreview && "bg-primary/5 border border-primary/20",
            highlightPath && "bg-primary/5 border border-primary/20 animate-pulse ring-2 ring-primary/50 ring-offset-2",
            !hasPreview && !highlightPath && "bg-muted/30 border border-transparent",
            "hover:bg-muted/50",
            isDeleted && "opacity-50"
        )}>
            <Icon className={cn("size-4 shrink-0", iconColor, isDeleted && "opacity-50")} />
            <div className="flex-1 min-w-0">
                {hasPreview ? (
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-medium text-primary/80 uppercase tracking-wide">Preview</span>
                            {isDeleted && (
                                <span className="text-[10px] font-medium text-destructive/80">Deleted</span>
                            )}
                        </div>
                        <p className="text-muted-foreground/60 font-mono text-xs line-through truncate">
                            {relativePath}
                        </p>
                        <p className="text-foreground font-mono font-medium text-sm truncate">
                            {newRelativePath}
                        </p>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <p className={cn(
                            "font-mono font-medium text-sm truncate",
                            isDeleted ? "text-muted-foreground/60 line-through" : "text-foreground"
                        )} title={file.path}>
                            {relativePath}
                        </p>
                        {isDeleted && (
                            <XCircle className="size-3.5 shrink-0 text-destructive/70" />
                        )}
                    </div>
                )}
            </div>
        </div>
    )

    if (showRenameMenu) {
        return (
            <ContextMenu>
                <ContextMenuTrigger asChild>
                    {fileContent}
                </ContextMenuTrigger>
                <ContextMenuContent>
                    <ContextMenuItem
                        onClick={() => {
                            if (!file.path || file.isDeleted) return

                            // Calculate relative path from media folder
                            const mediaFolderPath = selectedMediaMetadata?.mediaFolderPath
                            let relativePath: string

                            if (mediaFolderPath) {
                                try {
                                    relativePath = relative(mediaFolderPath, file.path)
                                } catch (error) {
                                    // If relative path calculation fails, use absolute path
                                    relativePath = file.path
                                }
                            } else {
                                relativePath = file.path
                            }

                            const [openRename] = renameDialog
                            openRename(
                                async (newRelativePath: string) => {
                                    if (!selectedMediaMetadata?.mediaFolderPath || !file.path) {
                                        console.error("Missing required paths for rename")
                                        return
                                    }

                                    try {
                                        // Convert relative path to absolute path
                                        const newAbsolutePath = join(selectedMediaMetadata.mediaFolderPath, newRelativePath)

                                        // Call renameFile API
                                        await renameFile({
                                            mediaFolder: selectedMediaMetadata.mediaFolderPath,
                                            from: file.path,
                                            to: newAbsolutePath,
                                        })

                                        // Refresh media metadata to reflect the rename
                                        refreshMediaMetadata(selectedMediaMetadata.mediaFolderPath)

                                        console.log("File renamed successfully:", file.path, "->", newAbsolutePath)
                                        toast.success(t('episodeFile.renameSuccess', { ns: 'components' }))
                                    } catch (error) {
                                        console.error("Failed to rename file:", error)
                                        const errorMessage = error instanceof Error ? error.message : t('episodeFile.renameFailed', { ns: 'components' })
                                        toast.error(t('episodeFile.renameFailed', { ns: 'components' }), {
                                            description: errorMessage
                                        })
                                        throw error // Re-throw to let dialog handle it
                                    }
                                },
                                {
                                    initialValue: relativePath,
                                    title: t('dialogs:rename.title'),
                                    description: t('dialogs:rename.fileDescription')
                                }
                            )
                        }}
                    >
                        {t('episodeFile.rename', { ns: 'components' })}
                    </ContextMenuItem>
                    <ContextMenuItem
                        disabled={!onFileSelectButtonClick}
                        onClick={() => {
                            if (onFileSelectButtonClick) {
                                onFileSelectButtonClick(file)
                            }
                        }}
                    >
                        {t('episodeFile.selectFile', { ns: 'components' })}
                    </ContextMenuItem>
                </ContextMenuContent>
            </ContextMenu>
        )
    }

    return fileContent
}

