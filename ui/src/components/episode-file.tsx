import { FileEdit, LucideIcon } from "lucide-react"
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
}

export function EpisodeFile({
    file,
    icon: Icon,
    label,
    iconColor = "text-muted-foreground",
    isPreviewMode,
    showRenameMenu = false,
}: EpisodeFileProps) {
    const { selectedMediaMetadata, refreshMediaMetadata } = useMediaMetadata()
    const { renameDialog } = useDialogs()

    const fileContent = (
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
                                {file.path}
                            </p>
                            <p className="text-xs text-primary font-mono truncate font-medium">
                                {file.newPath}
                            </p>
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground font-mono truncate">
                            {file.path}
                        </p>
                    )}
                </>
            ) : (
                <div className="flex items-center gap-2">
                    <Icon className={cn("size-3", iconColor)} />
                    {isPreviewMode && file.newPath ? (
                        <div className="flex-1 min-w-0 space-y-1">
                            <p className="text-xs text-muted-foreground font-mono truncate line-through">
                                {file.path}
                            </p>
                            <p className="text-xs text-primary font-mono truncate font-medium">
                                {file.newPath}
                            </p>
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground font-mono truncate flex-1">
                            {file.path}
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

