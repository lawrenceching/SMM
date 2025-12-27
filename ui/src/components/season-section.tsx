import type { MediaFileMetadata, TMDBEpisode, TMDBSeason, TMDBTVShowDetails } from "@core/types"
import { Badge } from "@/components/ui/badge"
import { Tv, ChevronDown } from "lucide-react"
import { cn, findAssociatedFiles } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { EpisodeSection } from "./episode-section"
import { useMediaMetadata } from "./media-metadata-provider"
import type { FileProps } from "@/lib/types"
import { useMemo } from "react"
import type { MediaMetadata } from "@core/types"
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


function mapTagToFileType(tag: "VID" | "SUB" | "AUD" | "NFO" | "POSTER" | ""): "file" | "video" | "subtitle" | "audio" | "nfo" | "poster" {
    switch(tag) {
        case "VID":
            return "video"
        case "SUB":
            return "subtitle"
        case "AUD":
            return "audio"
        case "NFO":
            return "nfo"
        case "POSTER":
            return "poster"
        default:
            return "file"
    }
}


function buildFileProps(mm: MediaMetadata, seasonNumber: number, episodeNumber: number): FileProps[] {

    if(mm.mediaFolderPath === undefined) {
        console.error(`Media folder path is undefined`)
        throw new Error(`Media folder path is undefined`)
    }

    if(mm.mediaFiles === undefined) {
        console.error(`Media files are undefined`)
        throw new Error(`Media files are undefined`)
    }

    if(mm.files === undefined || mm.files === null) {
        return [];
    }

    const mediaFile: MediaFileMetadata | undefined = mm.mediaFiles?.find(file => file.seasonNumber === seasonNumber && file.episodeNumber === episodeNumber)

    if(!mediaFile) {
        return [];
    }

    const episodeVideoFilePath = mediaFile.absolutePath

    const files = findAssociatedFiles(mm.mediaFolderPath, mm.files, episodeVideoFilePath)

    const fileProps: FileProps[] = [
        {
            type: "video",
            path: mediaFile.absolutePath,
        },
        ...files.map(file => ({
            type: mapTagToFileType(file.tag),
            path: file.path,
            newPath: file.newPath
        }))
    ];

    return fileProps;

}

interface EpisodeModel {
    episode: TMDBEpisode,
    files: FileProps[],
}

interface SeasonModel {
    season: TMDBSeason,
    episodes: EpisodeModel[],
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

    const seasons: SeasonModel[] = useMemo(() => {

        if(!selectedMediaMetadata) {
            return [];
        }

        return tvShow.seasons.map(season => ({
            season: season,
            episodes: season.episodes?.map(episode => ({
                episode: episode,
                files: buildFileProps(selectedMediaMetadata, season.season_number, episode.episode_number)
            })) || []
        }))
        
    }, [tvShow.seasons, selectedMediaMetadata])

    return (
        <div className="space-y-2">
            <h2 className="text-lg font-semibold flex items-center gap-2">
                <Tv className="size-5" />
                Seasons ({tvShow?.number_of_seasons})
            </h2>
            <div className="space-y-3">
                {seasons
                    .filter(seasonModel => seasonModel.season.season_number > 0) // Filter out specials (season 0)
                    .map((seasonModel) => {
                        const { season, episodes } = seasonModel
                        const seasonPosterUrl = getTMDBImageUrl(season.poster_path, "w200")
                        const isExpanded = expandedSeasonIds.has(season.id)
                        const hasEpisodes = episodes && episodes.length > 0
                        
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
                                                episodes.map((episodeModel) => {
                                                    const { episode, files } = episodeModel
                                                    
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

