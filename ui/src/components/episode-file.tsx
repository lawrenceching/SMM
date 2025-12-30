import { FileEdit } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { useDialogs } from "./dialog-provider"
import { useMediaMetadata } from "./media-metadata-provider"
import { relative, join } from "@/lib/path"
import { renameFile } from "@/api/renameFile"
import { toast } from "sonner"
import type { FileProps } from "@/lib/types"

interface EpisodeFileProps {
    file: FileProps
    icon: LucideIcon
    label?: string
    iconColor?: string
    isPreviewMode: boolean
    showRenameMenu?: boolean
    compact?: boolean
    bgColor?: string
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
    bgColor = "bg-primary/10",
}: EpisodeFileProps) {
    const { selectedMediaMetadata, refreshMediaMetadata } = useMediaMetadata()
    const { renameDialog } = useDialogs()

    const mediaFolderPath = selectedMediaMetadata?.mediaFolderPath
    const relativePath = getRelativePath(mediaFolderPath, file.path)
    const newRelativePath = file.newPath ? getRelativePath(mediaFolderPath, file.newPath) : null
    const hasPreview = isPreviewMode && file.newPath

    const fileContent = compact ? (
        <div className={cn(
            "group relative flex items-center gap-3 px-3 py-2.5 transition-colors",
            hasPreview ? "bg-primary/10" : bgColor,
            "hover:bg-primary/15"
        )}>
            <Icon className={cn("size-5 shrink-0", iconColor)} />
            <div className="flex-1 min-w-0">
                {hasPreview ? (
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-semibold text-primary uppercase tracking-wide">Preview</span>
                        </div>
                        <p className="text-muted-foreground/70 font-mono text-xs line-through truncate">
                            {relativePath}
                        </p>
                        <p className="text-foreground font-mono font-semibold text-sm truncate">
                            {newRelativePath}
                        </p>
                    </div>
                ) : (
                    <p className="text-foreground font-mono font-semibold text-sm truncate" title={file.path}>
                        {relativePath}
                    </p>
                )}
            </div>
        </div>
    ) : (
        <div className={cn(
            "p-2 rounded-md border",
            isPreviewMode && file.newPath ? "bg-primary/5 border-primary/20" : "bg-background border-border"
        )}>
            {label ? (
                <>
                    <div className="flex items-center gap-2 mb-1">
                        <Icon className={cn("size-4", iconColor)} />
                        <span className="text-xs font-semibold">{label}</span>
                        {isPreviewMode && file.newPath && (
                            <span className="text-xs text-primary font-medium">(Preview)</span>
                        )}
                    </div>
                    {isPreviewMode && file.newPath ? (
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground font-mono truncate line-through">
                                {relativePath}
                            </p>
                            <p className="text-xs text-primary font-mono truncate font-medium">
                                {newRelativePath}
                            </p>
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground font-mono truncate">
                            {relativePath}
                        </p>
                    )}
                </>
            ) : (
                <div className="flex items-center gap-2">
                    <Icon className={cn("size-3", iconColor)} />
                    {isPreviewMode && file.newPath ? (
                        <div className="flex-1 min-w-0 space-y-1">
                            <p className="text-xs text-muted-foreground font-mono truncate line-through">
                                {relativePath}
                            </p>
                            <p className="text-xs text-primary font-mono truncate font-medium">
                                {newRelativePath}
                            </p>
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground font-mono truncate flex-1">
                            {relativePath}
                        </p>
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
                            if (!file.path) return
                            
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
                                        toast.success("File renamed successfully")
                                    } catch (error) {
                                        console.error("Failed to rename file:", error)
                                        const errorMessage = error instanceof Error ? error.message : "Failed to rename file"
                                        toast.error("Failed to rename file", {
                                            description: errorMessage
                                        })
                                        throw error // Re-throw to let dialog handle it
                                    }
                                },
                                {
                                    initialValue: relativePath,
                                    title: "Rename File",
                                    description: "Enter the new relative path for the file"
                                }
                            )
                        }}
                    >
                        <FileEdit className="size-4 mr-2" />
                        Rename
                    </ContextMenuItem>
                </ContextMenuContent>
            </ContextMenu>
        )
    }

    return fileContent
}

