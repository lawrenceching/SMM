import type { TMDBTVShowDetails } from "@core/types"
import { Badge } from "@/components/ui/badge"
import { Tv, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { EpisodeSection } from "./episode-section"
import { useMediaMetadata } from "./media-metadata-provider"
import type { FileProps } from "@/lib/types"
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

interface SeasonSectionProps {
    tvShow?: TMDBTVShowDetails
    isUpdatingTvShow: boolean
    expandedSeasonIds: Set<number>
    setExpandedSeasonIds: React.Dispatch<React.SetStateAction<Set<number>>>
    expandedEpisodeIds: Set<number>
    setExpandedEpisodeIds: React.Dispatch<React.SetStateAction<Set<number>>>
    isPreviewMode?: boolean
    ruleName?: "plex"
}

export function SeasonSection({
    tvShow,
    isUpdatingTvShow,
    expandedSeasonIds,
    setExpandedSeasonIds,
    expandedEpisodeIds,
    setExpandedEpisodeIds,
    isPreviewMode = false,
    ruleName,
}: SeasonSectionProps) {
    const { selectedMediaMetadata } = useMediaMetadata()

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
                        const isExpanded = expandedSeasonIds.has(season.id)
                        const hasEpisodes = season.episodes && season.episodes.length > 0
                        
                        return (
                            <div
                                key={season.id}
                                className="rounded-lg border bg-card overflow-hidden transition-all"
                            >
                                <div
                                    onClick={() => {
                                        if (isPreviewMode) return // Don't allow collapse in preview mode
                                        setExpandedSeasonIds(prev => {
                                            const newSet = new Set(prev)
                                            if (isExpanded) {
                                                newSet.delete(season.id)
                                            } else {
                                                newSet.add(season.id)
                                            }
                                            return newSet
                                        })
                                    }}
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
                                                    // Find matching media files for this episode
                                                    const matchingMediaFiles = selectedMediaMetadata?.mediaFiles?.filter(
                                                        file => file.seasonNumber === season.season_number && 
                                                                file.episodeNumber === episode.episode_number
                                                    ) || []
                                                    
                                                    // Convert MediaFileMetadata to FileProps[]
                                                    const files: FileProps[] = []
                                                    
                                                    // Add video file
                                                    const videoFile = matchingMediaFiles.find(file => file.absolutePath)
                                                    if (videoFile?.absolutePath) {
                                                        files.push({
                                                            type: "video",
                                                            path: videoFile.absolutePath,
                                                            newPath: "abc.mp3"
                                                        })
                                                    }
                                                    
                                                    // Add subtitle files
                                                    matchingMediaFiles.forEach(file => {
                                                        file.subtitleFilePaths?.forEach(path => {
                                                            files.push({
                                                                type: "subtitle",
                                                                path: path,
                                                            })
                                                        })
                                                    })
                                                    
                                                    // Add audio files
                                                    matchingMediaFiles.forEach(file => {
                                                        file.audioFilePaths?.forEach(path => {
                                                            files.push({
                                                                type: "audio",
                                                                path: path,
                                                            })
                                                        })
                                                    })
                                                    
                                                    return (
                                                        <EpisodeSection
                                                            key={episode.id}
                                                            episode={episode}
                                                            expandedEpisodeIds={expandedEpisodeIds}
                                                            setExpandedEpisodeIds={setExpandedEpisodeIds}
                                                            files={files}
                                                            isPreviewMode={isPreviewMode}
                                                            ruleName={ruleName}
                                                            seasonNumber={season.season_number}
                                                            tvshowName={tvShow?.name || ""}
                                                            tmdbId={tvShow?.id?.toString() || ""}
                                                            releaseYear={tvShow?.first_air_date ? new Date(tvShow.first_air_date).getFullYear().toString() : ""}
                                                        />
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

