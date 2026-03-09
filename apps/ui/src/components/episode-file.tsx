import { XCircle } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { useDialogs } from "@/providers/dialog-provider"
import { useMediaMetadataStoreState } from "@/stores/mediaMetadataStore";
import { useMediaMetadataActions } from "@/actions/mediaMetadataActions";
import { relative, join, basename, dirname, extname } from "@/lib/path"
import { renameFiles } from "@/api/renameFiles"
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

/**
 * Computes rename entries for all files that share the same stem as the video
 * being renamed. Operates directly on the raw file list from media metadata so
 * it is not affected by how the UI has classified/grouped those files.
 *
 * Example: renaming "S01E01.mkv" → "Show.S01E01.Title.mkv" will also rename
 * "S01E01.srt" → "Show.S01E01.Title.srt" and "S01E01.en.srt" → "Show.S01E01.Title.en.srt"
 *
 * @param videoOldPath  Absolute POSIX path of the video before rename
 * @param videoNewPath  Absolute POSIX path of the video after rename
 * @param allMediaFiles All file paths in the media folder (from MediaMetadata.files)
 */
export function computeAssociatedFileRenames(
    videoOldPath: string,
    videoNewPath: string,
    allMediaFiles: string[]
): Array<{ from: string; to: string }> {
    const oldBasename = basename(videoOldPath) ?? ''
    const oldExt = extname(oldBasename)
    const oldStem = oldBasename.slice(0, oldBasename.length - oldExt.length)

    const newBasename = basename(videoNewPath) ?? ''
    const newExt = extname(newBasename)
    const newStem = newBasename.slice(0, newBasename.length - newExt.length)

    if (!oldStem || !newStem || oldStem === newStem) return []

    const renames: Array<{ from: string; to: string }> = []
    for (const filePath of allMediaFiles) {
        if (filePath === videoOldPath) continue // skip the video file itself

        const assocBasename = basename(filePath) ?? ''
        // Match files whose name is exactly the old stem or starts with "oldStem."
        // e.g. "S01E01.srt", "S01E01.en.srt", "S01E01.ass"
        if (assocBasename === oldStem || assocBasename.startsWith(oldStem + '.')) {
            const suffix = assocBasename.slice(oldStem.length) // e.g. ".en.srt" or ".srt"
            const newAssocBasename = newStem + suffix
            const assocDir = dirname(filePath)
            const newAssocPath = join(assocDir, newAssocBasename)
            renames.push({ from: filePath, to: newAssocPath })
        }
    }
    return renames
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
    const { selectedMediaMetadata } = useMediaMetadataStoreState();
    const { refreshMediaMetadata } = useMediaMetadataActions();
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

                                        // All files in the media folder (absolute POSIX paths from metadata)
                                        const allMediaFiles = selectedMediaMetadata.files ?? []

                                        // Compute renames for every file sharing the same stem as the video
                                        const assocRenames = computeAssociatedFileRenames(file.path, newAbsolutePath, allMediaFiles)

                                        // Call renameFiles API with video + all associated files in one batch
                                        await renameFiles({
                                            files: [
                                                { from: file.path, to: newAbsolutePath },
                                                ...assocRenames,
                                            ],
                                        })

                                        // Refresh media metadata to reflect the rename
                                        refreshMediaMetadata(selectedMediaMetadata.mediaFolderPath)

                                        console.log("File renamed successfully:", file.path, "->", newAbsolutePath)
                                        if (assocRenames.length > 0) {
                                            console.log("Associated files renamed:", assocRenames)
                                        }
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

