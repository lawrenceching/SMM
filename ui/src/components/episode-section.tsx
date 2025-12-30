import type { TMDBTVShowDetails } from "@core/types"
import { ChevronDown, Play, FileVideo, FileText, Music, Image as ImageIcon, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import type { FileProps } from "@/lib/types"
import { EpisodeFile } from "./episode-file"
import { useMemo } from "react"
import React from "react"

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

// Helper function to get icon and label for file type
function getFileTypeConfig(type: FileProps['type']): { icon: typeof FileVideo, label: string, iconColor: string, bgColor: string } {
    switch (type) {
        case "video":
            return { icon: FileVideo, label: "Video", iconColor: "text-primary", bgColor: "bg-primary/10" }
        case "subtitle":
            return { icon: FileText, label: "Subtitle", iconColor: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-50 dark:bg-blue-950/30" }
        case "audio":
            return { icon: Music, label: "Audio", iconColor: "text-green-600 dark:text-green-400", bgColor: "bg-green-50 dark:bg-green-950/30" }
        case "nfo":
            return { icon: FileText, label: "NFO", iconColor: "text-muted-foreground", bgColor: "bg-muted/50" }
        case "poster":
            return { icon: ImageIcon, label: "Poster", iconColor: "text-muted-foreground", bgColor: "bg-muted/50" }
        case "file":
        default:
            return { icon: FileVideo, label: "File", iconColor: "text-muted-foreground", bgColor: "bg-muted/50" }
    }
}

// Helper function to extract filename from path
function getFileName(path: string): string {
    const parts = path.split(/[/\\]/)
    return parts[parts.length - 1] || path
}



export interface EpisodeSectionProps {
    episode: NonNullable<NonNullable<TMDBTVShowDetails['seasons']>[number]['episodes']>[number]
    expandedEpisodeIds: Set<number>
    setExpandedEpisodeIds: React.Dispatch<React.SetStateAction<Set<number>>>
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
    /**
     * Map of file paths to their generated new paths (for preview mode)
     */
    generatedFileNames?: Map<string, string>
}

export function EpisodeSection({
    episode,
    expandedEpisodeIds,
    setExpandedEpisodeIds,
    files,
    isPreviewMode,
    generatedFileNames = new Map(),
}: EpisodeSectionProps) {
    const episodeStillUrl = getTMDBImageUrl(episode.still_path, "w300")
    const isEpisodeExpanded = expandedEpisodeIds.has(episode.id)
    
    // Update files with generated new paths
    const filesWithNewPaths = useMemo(() => {
        return files.map(file => {
            if (file.type === "video" && generatedFileNames.has(file.path)) {
                return {
                    ...file,
                    newPath: generatedFileNames.get(file.path) || file.newPath
                }
            }
            return file
        })
    }, [files, generatedFileNames])
    
    // Group files by type
    const filesByType = useMemo(() => {
        const grouped = new Map<FileProps['type'], FileProps[]>()
        filesWithNewPaths.forEach(file => {
            const existing = grouped.get(file.type) || []
            grouped.set(file.type, [...existing, file])
        })
        return grouped
    }, [filesWithNewPaths])
    
    // Convert Map to array of entries for rendering
    const filesByTypeArray = useMemo(() => {
        return Array.from(filesByType.entries()) as Array<[FileProps['type'], FileProps[]]>
    }, [filesByType])
    
    return (
        <div className="rounded-md bg-background border overflow-hidden transition-all">
            <div
                onClick={() => {
                    if (isPreviewMode) return // Don't allow collapse in preview mode
                    setExpandedEpisodeIds(prev => {
                        const newSet = new Set(prev)
                        if (isEpisodeExpanded) {
                            newSet.delete(episode.id)
                        } else {
                            newSet.add(episode.id)
                        }
                        return newSet
                    })
                }}
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
                <div className="border-t bg-muted/30">
                    {files.length === 0 ? (
                        <div className="text-center py-6 text-xs text-muted-foreground">
                            No files associated with this episode
                        </div>
                    ) : (
                        <div className="px-3 py-2">
                            {/* Video Files - Main (Emphasized) */}
                            {filesByTypeArray.map(([type, typeFiles]) => {
                                if (type !== "video") return null
                                const { icon: TypeIcon, iconColor } = getFileTypeConfig(type)
                                
                                return typeFiles.map((file, index) => (
                                    <EpisodeFile
                                        key={`${type}-${index}-${file.path}`}
                                        file={file}
                                        icon={TypeIcon}
                                        label=""
                                        iconColor={iconColor}
                                        isPreviewMode={isPreviewMode}
                                        showRenameMenu={true}
                                        compact={true}
                                        bgColor="bg-primary/10"
                                    />
                                ))
                            })}
                            
                            {/* Associated Files - Subtitle, Audio, NFO, Poster, etc. (Subtle) */}
                            {filesByTypeArray.map(([type, typeFiles]) => {
                                if (type === "video") return null
                                const { label, iconColor } = getFileTypeConfig(type)
                                
                                return typeFiles.map((file, index) => {
                                    const Icon = getFileIcon(file.path)
                                    const fileName = getFileName(file.path)
                                    const newFileName = file.newPath ? getFileName(file.newPath) : null
                                    const hasPreview = isPreviewMode && file.newPath
                                    
                                    return (
                                        <div
                                            key={`${type}-${index}-${file.path}`}
                                            className={cn(
                                                "group flex items-center gap-2 px-2 py-1.5 text-xs transition-colors",
                                                "hover:bg-muted/50",
                                                hasPreview && "bg-primary/5"
                                            )}
                                        >
                                            <Icon className={cn("size-3 shrink-0 opacity-60", iconColor)} />
                                            <div className="flex-1 min-w-0">
                                                {hasPreview ? (
                                                    <div className="space-y-0.5">
                                                        <p className="text-muted-foreground/60 font-mono text-[10px] line-through truncate">
                                                            {fileName}
                                                        </p>
                                                        <p className="text-muted-foreground font-mono text-[10px] truncate">
                                                            {newFileName}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <p className="text-muted-foreground font-mono text-[10px] truncate" title={file.path}>
                                                        {fileName}
                                                    </p>
                                                )}
                                            </div>
                                            <span className={cn(
                                                "px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 opacity-70",
                                                iconColor
                                            )}>
                                                {label}
                                            </span>
                                        </div>
                                    )
                                })
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

