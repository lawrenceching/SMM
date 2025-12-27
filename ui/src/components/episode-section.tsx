import type { TMDBTVShowDetails } from "@core/types"
import { ChevronDown, Play, FileVideo, FileText, Music, Image as ImageIcon, FileEdit, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { useDialogs } from "./dialog-provider"
import { useMediaMetadata } from "./media-metadata-provider"
import { relative, join } from "@/lib/path"
import { renameFile } from "@/api/renameFile"
import { toast } from "sonner"
import type { FileProps } from "@/lib/types"

// Helper function to format date
function formatDate(dateString: string): string {
    if (!dateString) return "N/A"
    try {
        const date = new Date(dateString)
        return date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric"
        })
    } catch {
        return dateString
    }
}

// Helper function to get TMDB image URL
function getTMDBImageUrl(path: string | null, size: "w200" | "w300" | "w500" | "w780" | "original" = "w500"): string | null {
    if (!path) return null
    const baseUrl = "https://image.tmdb.org/t/p"
    return `${baseUrl}/${size}${path}`
}

// Helper function to get file icon based on extension
function getFileIcon(path: string) {
    const ext = path.split('.').pop()?.toLowerCase()
    if (['srt', 'vtt', 'ass', 'ssa'].includes(ext || '')) return FileText
    if (['mp3', 'aac', 'flac', 'wav'].includes(ext || '')) return Music
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) return ImageIcon
    return FileVideo
}



interface EpisodeSectionProps {
    episode: NonNullable<NonNullable<TMDBTVShowDetails['seasons']>[number]['episodes']>[number]
    expandedEpisodeId: number | null
    setExpandedEpisodeId: (id: number | null) => void
    /**
     * files of the episode, which holds:
     * * video file
     * * subtitle files
     * * audio files
     * * nfo files
     * * poster files
     * * other files that may supported in the future
     */
    files: FileProps[]

    /**
     * If true, the episode section display the new path which user to preview
     */
    isPreviewMode: boolean
}

export function EpisodeSection({
    episode,
    expandedEpisodeId,
    setExpandedEpisodeId,
    files,
    isPreviewMode,
}: EpisodeSectionProps) {
    const { selectedMediaMetadata, refreshMediaMetadata } = useMediaMetadata()
    const { renameDialog } = useDialogs()

    const episodeStillUrl = getTMDBImageUrl(episode.still_path, "w300")
    const isEpisodeExpanded = expandedEpisodeId === episode.id
    
    // Extract files by type from files prop
    const videoFile = files.find(file => file.type === "video")
    const subtitleFiles = files.filter(file => file.type === "subtitle")
    const audioFiles = files.filter(file => file.type === "audio")
    
    // Helper function to get display path based on preview mode
    const getDisplayPath = (file: FileProps): string => {
        if (isPreviewMode && file.newPath) {
            return file.newPath
        }
        return file.path
    }
    
    return (
        <div className="rounded-md bg-background border overflow-hidden transition-all">
            <div
                onClick={() => setExpandedEpisodeId(isEpisodeExpanded ? null : episode.id)}
                className="flex gap-3 p-3 hover:bg-accent/50 transition-colors cursor-pointer"
            >
                {episodeStillUrl ? (
                    <div className="shrink-0">
                        <img
                            src={episodeStillUrl}
                            alt={episode.name}
                            className="w-32 h-20 object-cover rounded-md bg-muted"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.style.display = "none"
                            }}
                        />
                    </div>
                ) : (
                    <div className="shrink-0 w-32 h-20 rounded-md bg-muted flex items-center justify-center">
                        <Play className="size-6 text-muted-foreground/50" />
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground">
                                E{episode.episode_number.toString().padStart(2, '0')}
                            </span>
                            <h4 className="font-semibold text-sm">
                                {episode.name}
                            </h4>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {episode.vote_average > 0 && (
                                <div className="flex items-center gap-1">
                                    <Star className="size-3 fill-yellow-500 text-yellow-500" />
                                    <span className="text-xs text-muted-foreground">
                                        {episode.vote_average.toFixed(1)}
                                    </span>
                                </div>
                            )}
                            <ChevronDown 
                                className={cn(
                                    "size-4 text-muted-foreground transition-transform",
                                    isEpisodeExpanded && "transform rotate-180"
                                )}
                            />
                        </div>
                    </div>
                    {episode.air_date && (
                        <p className="text-xs text-muted-foreground mb-1">
                            {formatDate(episode.air_date)}
                        </p>
                    )}
                    {episode.runtime > 0 && (
                        <p className="text-xs text-muted-foreground mb-2">
                            {episode.runtime} min
                        </p>
                    )}
                    {episode.overview && (
                        <p className={cn(
                            "text-xs text-muted-foreground",
                            !isEpisodeExpanded && "line-clamp-2"
                        )}>
                            {episode.overview}
                        </p>
                    )}
                </div>
            </div>
            
            {/* Files - Expandable */}
            {isEpisodeExpanded && (
                <div className="px-3 pb-3 border-t bg-muted/20">
                    <div className="pt-3 space-y-2">
                        {/* Video File */}
                        {videoFile && (
                            <ContextMenu>
                                <ContextMenuTrigger asChild>
                                    <div className={cn(
                                        "p-2 rounded-md border",
                                        isPreviewMode && videoFile.newPath ? "bg-primary/5 border-primary/20" : "bg-background border-border"
                                    )}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <FileVideo className="size-4 text-primary" />
                                            <span className="text-xs font-semibold">Video File</span>
                                            {isPreviewMode && videoFile.newPath && (
                                                <span className="text-xs text-primary font-medium">(Preview)</span>
                                            )}
                                        </div>
                                        {isPreviewMode && videoFile.newPath ? (
                                            <div className="space-y-1">
                                                <p className="text-xs text-muted-foreground font-mono truncate line-through">
                                                    {videoFile.path}
                                                </p>
                                                <p className="text-xs text-primary font-mono truncate font-medium">
                                                    {videoFile.newPath}
                                                </p>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-muted-foreground font-mono truncate">
                                                {videoFile.path}
                                            </p>
                                        )}
                                    </div>
                                </ContextMenuTrigger>
                                <ContextMenuContent>
                                    <ContextMenuItem
                                        onClick={() => {
                                            if (!videoFile.path) return
                                            
                                            // Calculate relative path from media folder
                                            const mediaFolderPath = selectedMediaMetadata?.mediaFolderPath
                                            let relativePath: string
                                            
                                            if (mediaFolderPath) {
                                                try {
                                                    relativePath = relative(mediaFolderPath, videoFile.path)
                                                } catch (error) {
                                                    // If relative path calculation fails, use absolute path
                                                    relativePath = videoFile.path
                                                }
                                            } else {
                                                relativePath = videoFile.path
                                            }
                                            
                                            const [openRename] = renameDialog
                                            openRename(
                                                async (newRelativePath: string) => {
                                                    if (!selectedMediaMetadata?.mediaFolderPath || !videoFile.path) {
                                                        console.error("Missing required paths for rename")
                                                        return
                                                    }

                                                    try {
                                                        // Convert relative path to absolute path
                                                        const newAbsolutePath = join(selectedMediaMetadata.mediaFolderPath, newRelativePath)
                                                        
                                                        // Call renameFile API
                                                        await renameFile({
                                                            mediaFolder: selectedMediaMetadata.mediaFolderPath,
                                                            from: videoFile.path,
                                                            to: newAbsolutePath,
                                                        })

                                                        // Refresh media metadata to reflect the rename
                                                        refreshMediaMetadata(selectedMediaMetadata.mediaFolderPath)
                                                        
                                                        console.log("File renamed successfully:", videoFile.path, "->", newAbsolutePath)
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
                        )}
                        
                        {/* Subtitle Files */}
                        {subtitleFiles.length > 0 && (
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <FileText className="size-4 text-blue-500" />
                                    <span className="text-xs font-semibold">Subtitle Files ({subtitleFiles.length})</span>
                                </div>
                                {subtitleFiles.map((file, index) => {
                                    const Icon = getFileIcon(file.path)
                                    const displayPath = getDisplayPath(file)
                                    return (
                                        <div 
                                            key={index} 
                                            className={cn(
                                                "p-2 rounded-md border",
                                                isPreviewMode && file.newPath ? "bg-primary/5 border-primary/20" : "bg-background border-border"
                                            )}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Icon className="size-3 text-muted-foreground" />
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
                                                        {displayPath}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                        
                        {/* Audio Files */}
                        {audioFiles.length > 0 && (
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <Music className="size-4 text-green-500" />
                                    <span className="text-xs font-semibold">Audio Files ({audioFiles.length})</span>
                                </div>
                                {audioFiles.map((file, index) => {
                                    const Icon = getFileIcon(file.path)
                                    const displayPath = getDisplayPath(file)
                                    return (
                                        <div 
                                            key={index} 
                                            className={cn(
                                                "p-2 rounded-md border",
                                                isPreviewMode && file.newPath ? "bg-primary/5 border-primary/20" : "bg-background border-border"
                                            )}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Icon className="size-3 text-muted-foreground" />
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
                                                        {displayPath}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                        
                        {/* No files message */}
                        {!videoFile && subtitleFiles.length === 0 && audioFiles.length === 0 && (
                            <div className="text-center py-4 text-xs text-muted-foreground">
                                No files associated with this episode
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

