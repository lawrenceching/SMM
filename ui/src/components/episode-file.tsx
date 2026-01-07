import { FileEdit, XCircle } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { useDialogs } from "./dialog-provider"
import { useMediaMetadata } from "./media-metadata-provider"
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
    isPreviewMode: boolean
    showRenameMenu?: boolean
    compact?: boolean
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
    label,
    iconColor = "text-muted-foreground",
    isPreviewMode,
    showRenameMenu = false,
    compact = false,
}: EpisodeFileProps) {
    const { t } = useTranslation(['components', 'dialogs'])
    const { selectedMediaMetadata, refreshMediaMetadata } = useMediaMetadata()
    const { renameDialog } = useDialogs()

    const mediaFolderPath = selectedMediaMetadata?.mediaFolderPath
    const relativePath = getRelativePath(mediaFolderPath, file.path)
    const newRelativePath = file.newPath ? getRelativePath(mediaFolderPath, file.newPath) : null
    const hasPreview = isPreviewMode && file.newPath
    const isDeleted = file.isDeleted ?? false

    const fileContent = compact ? (
        <div className={cn(
            "group relative flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors",
            hasPreview ? "bg-primary/5 border border-primary/20" : "bg-muted/30 border border-transparent",
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
    ) : (
        <div className={cn(
            "p-2.5 rounded-md border transition-colors",
            isPreviewMode && file.newPath ? "bg-primary/5 border-primary/20" : "bg-background border-border",
            "hover:bg-muted/30",
            isDeleted && "opacity-50"
        )}>
            {label ? (
                <>
                    <div className="flex items-center gap-2 mb-1.5">
                        <Icon className={cn("size-3.5", iconColor, isDeleted && "opacity-50")} />
                        <span className="text-xs font-semibold">{label}</span>
                        {isPreviewMode && file.newPath && (
                            <span className="text-[10px] text-primary/80 font-medium uppercase tracking-wide">Preview</span>
                        )}
                        {isDeleted && (
                            <span className="text-[10px] text-destructive/80 font-medium">Deleted</span>
                        )}
                    </div>
                    {isPreviewMode && file.newPath ? (
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground/60 font-mono truncate line-through">
                                {relativePath}
                            </p>
                            <p className="text-xs text-foreground font-mono truncate font-medium">
                                {newRelativePath}
                            </p>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <p className={cn(
                                "text-xs font-mono truncate",
                                isDeleted ? "text-muted-foreground/60 line-through" : "text-muted-foreground"
                            )}>
                                {relativePath}
                            </p>
                            {isDeleted && (
                                <XCircle className="size-3 shrink-0 text-destructive/70" />
                            )}
                        </div>
                    )}
                </>
            ) : (
                <div className="flex items-center gap-2">
                    <Icon className={cn("size-3.5", iconColor, isDeleted && "opacity-50")} />
                    {isPreviewMode && file.newPath ? (
                        <div className="flex-1 min-w-0 space-y-1">
                            <p className="text-xs text-muted-foreground/60 font-mono truncate line-through">
                                {relativePath}
                            </p>
                            <p className="text-xs text-foreground font-mono truncate font-medium">
                                {newRelativePath}
                            </p>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            <p className={cn(
                                "text-xs font-mono truncate",
                                isDeleted ? "text-muted-foreground/60 line-through" : "text-muted-foreground"
                            )}>
                                {relativePath}
                            </p>
                            {isDeleted && (
                                <XCircle className="size-3 shrink-0 text-destructive/70" />
                            )}
                        </div>
                    )}
                </div>
            )}
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
                        <FileEdit className="size-4 mr-2" />
                        {t('episodeFile.rename', { ns: 'components' })}
                    </ContextMenuItem>
                </ContextMenuContent>
            </ContextMenu>
        )
    }

    return fileContent
}

