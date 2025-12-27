import type { TMDBTVShowDetails } from "@core/types"
import { Badge } from "@/components/ui/badge"
import { Tv, ChevronDown, Play, FileVideo, FileText, Music, Image as ImageIcon, FileEdit, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { useDialogs } from "./dialog-provider"
import { useMediaMetadata } from "./media-metadata-provider"
import { relative, join } from "@/lib/path"
import { renameFile } from "@/api/renameFile"
import { toast } from "sonner"

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

interface SeasonSectionProps {
    tvShow?: TMDBTVShowDetails
    isUpdatingTvShow: boolean
    expandedSeasonId: number | null
    setExpandedSeasonId: (id: number | null) => void
    expandedEpisodeId: number | null
    setExpandedEpisodeId: (id: number | null) => void
}

export function SeasonSection({
    tvShow,
    isUpdatingTvShow,
    expandedSeasonId,
    setExpandedSeasonId,
    expandedEpisodeId,
    setExpandedEpisodeId,
}: SeasonSectionProps) {
    const { selectedMediaMetadata, refreshMediaMetadata } = useMediaMetadata()
    const { renameDialog } = useDialogs()

    if (isUpdatingTvShow) {
        return (
            <div className="space-y-2">
                <Skeleton className="h-6 w-24" />
                <div className="space-y-3">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                </div>
            </div>
        )
    }

    if (!tvShow?.seasons || tvShow.seasons.length === 0) {
        return null
    }

    return (
        <div className="space-y-2">
            <h2 className="text-lg font-semibold flex items-center gap-2">
                <Tv className="size-5" />
                Seasons ({tvShow?.number_of_seasons})
            </h2>
            <div className="space-y-3">
                {tvShow.seasons
                    .filter(season => season.season_number > 0) // Filter out specials (season 0)
                    .map((season) => {
                        const seasonPosterUrl = getTMDBImageUrl(season.poster_path, "w200")
                        const isExpanded = expandedSeasonId === season.id
                        const hasEpisodes = season.episodes && season.episodes.length > 0
                        
                        return (
                            <div
                                key={season.id}
                                className="rounded-lg border bg-card overflow-hidden transition-all"
                            >
                                <div
                                    onClick={() => setExpandedSeasonId(isExpanded ? null : season.id)}
                                    className="flex gap-4 p-4 hover:bg-accent/50 transition-colors cursor-pointer"
                                >
                                    {seasonPosterUrl ? (
                                        <div className="shrink-0">
                                            <img
                                                src={seasonPosterUrl}
                                                alt={season.name}
                                                className="w-24 h-36 object-cover rounded-md bg-muted"
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement
                                                    target.style.display = "none"
                                                }}
                                            />
                                        </div>
                                    ) : (
                                        <div className="shrink-0 w-24 h-36 rounded-md bg-muted flex items-center justify-center">
                                            <Tv className="size-8 text-muted-foreground/50" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                            <h3 className="font-semibold text-base">
                                                {season.name}
                                            </h3>
                                            <div className="flex items-center gap-2">
                                                {season.episode_count > 0 && (
                                                    <Badge variant="secondary" className="shrink-0">
                                                        {season.episode_count} {season.episode_count === 1 ? 'episode' : 'episodes'}
                                                    </Badge>
                                                )}
                                                <ChevronDown 
                                                    className={cn(
                                                        "size-5 text-muted-foreground transition-transform shrink-0",
                                                        isExpanded && "transform rotate-180"
                                                    )}
                                                />
                                            </div>
                                        </div>
                                        {season.air_date && (
                                            <p className="text-sm text-muted-foreground mb-2">
                                                {formatDate(season.air_date)}
                                            </p>
                                        )}
                                        {season.overview && (
                                            <p className={cn(
                                                "text-sm text-muted-foreground",
                                                !isExpanded && "line-clamp-3"
                                            )}>
                                                {season.overview}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Episodes - Expandable */}
                                {isExpanded && (
                                    <div className="px-4 pb-4 border-t bg-muted/30">
                                        <div className="pt-4 space-y-3">
                                            {hasEpisodes ? (
                                                season.episodes!.map((episode) => {
                                                    const episodeStillUrl = getTMDBImageUrl(episode.still_path, "w300")
                                                    const isEpisodeExpanded = expandedEpisodeId === episode.id
                                                    
                                                    // Find matching media files for this episode
                                                    const matchingMediaFiles = selectedMediaMetadata?.mediaFiles?.filter(
                                                        file => file.seasonNumber === season.season_number && 
                                                                file.episodeNumber === episode.episode_number
                                                    ) || []
                                                    
                                                    // Get video file (the main media file)
                                                    const videoFile = matchingMediaFiles.find(file => file.absolutePath)
                                                    
                                                    // Get associated files
                                                    const subtitleFiles = matchingMediaFiles.flatMap(file => file.subtitleFilePaths || [])
                                                    const audioFiles = matchingMediaFiles.flatMap(file => file.audioFilePaths || [])
                                                    
                                                    const getFileIcon = (path: string) => {
                                                        const ext = path.split('.').pop()?.toLowerCase()
                                                        if (['srt', 'vtt', 'ass', 'ssa'].includes(ext || '')) return FileText
                                                        if (['mp3', 'aac', 'flac', 'wav'].includes(ext || '')) return Music
                                                        if (['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) return ImageIcon
                                                        return FileVideo
                                                    }
                                                    
                                                    return (
                                                        <div
                                                            key={episode.id}
                                                            className="rounded-md bg-background border overflow-hidden transition-all"
                                                        >
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
                                                                                    <div className="p-2 rounded-md bg-background border">
                                                                                        <div className="flex items-center gap-2 mb-1">
                                                                                            <FileVideo className="size-4 text-primary" />
                                                                                            <span className="text-xs font-semibold">Video File</span>
                                                                                        </div>
                                                                                        <p className="text-xs text-muted-foreground font-mono truncate">
                                                                                            {videoFile.absolutePath}
                                                                                        </p>
                                                                                    </div>
                                                                                </ContextMenuTrigger>
                                                                                <ContextMenuContent>
                                                                                    <ContextMenuItem
                                                                                        onClick={() => {
                                                                                            if (!videoFile.absolutePath) return
                                                                                            
                                                                                            // Calculate relative path from media folder
                                                                                            const mediaFolderPath = selectedMediaMetadata?.mediaFolderPath
                                                                                            let relativePath: string
                                                                                            
                                                                                            if (mediaFolderPath) {
                                                                                                try {
                                                                                                    relativePath = relative(mediaFolderPath, videoFile.absolutePath)
                                                                                                } catch (error) {
                                                                                                    // If relative path calculation fails, use absolute path
                                                                                                    relativePath = videoFile.absolutePath
                                                                                                }
                                                                                            } else {
                                                                                                relativePath = videoFile.absolutePath
                                                                                            }
                                                                                            
                                                                                            const [openRename] = renameDialog
                                                                                            openRename(
                                                                                                async (newRelativePath: string) => {
                                                                                                    if (!selectedMediaMetadata?.mediaFolderPath || !videoFile.absolutePath) {
                                                                                                        console.error("Missing required paths for rename")
                                                                                                        return
                                                                                                    }

                                                                                                    try {
                                                                                                        // Convert relative path to absolute path
                                                                                                        const newAbsolutePath = join(selectedMediaMetadata.mediaFolderPath, newRelativePath)
                                                                                                        
                                                                                                        // Call renameFile API
                                                                                                        await renameFile({
                                                                                                            mediaFolder: selectedMediaMetadata.mediaFolderPath,
                                                                                                            from: videoFile.absolutePath,
                                                                                                            to: newAbsolutePath,
                                                                                                        })

                                                                                                        // Refresh media metadata to reflect the rename
                                                                                                        refreshMediaMetadata(selectedMediaMetadata.mediaFolderPath)
                                                                                                        
                                                                                                        console.log("File renamed successfully:", videoFile.absolutePath, "->", newAbsolutePath)
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
                                                                                {subtitleFiles.map((path, index) => {
                                                                                    const Icon = getFileIcon(path)
                                                                                    return (
                                                                                        <div key={index} className="p-2 rounded-md bg-background border">
                                                                                            <div className="flex items-center gap-2">
                                                                                                <Icon className="size-3 text-muted-foreground" />
                                                                                                <p className="text-xs text-muted-foreground font-mono truncate flex-1">
                                                                                                    {path}
                                                                                                </p>
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
                                                                                {audioFiles.map((path, index) => {
                                                                                    const Icon = getFileIcon(path)
                                                                                    return (
                                                                                        <div key={index} className="p-2 rounded-md bg-background border">
                                                                                            <div className="flex items-center gap-2">
                                                                                                <Icon className="size-3 text-muted-foreground" />
                                                                                                <p className="text-xs text-muted-foreground font-mono truncate flex-1">
                                                                                                    {path}
                                                                                                </p>
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
                                                })
                                            ) : (
                                                <div className="text-center py-8 text-sm text-muted-foreground">
                                                    Episode information not available
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
            </div>
        </div>
    )
}

