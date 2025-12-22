import type { TMDBTVShowDetails, TMDBTVShow } from "@core/types"
import { Badge } from "@/components/ui/badge"
import { Calendar, Star, TrendingUp, Globe, Tv, ChevronDown, Play, FileVideo, FileText, Music, Image as ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { ImmersiveSearchbox } from "./ImmersiveSearchbox"
import { useCallback, useState, useEffect } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { searchTmdb, getTvShowById } from "@/api/tmdb"
import { useConfig } from "./config-provider"
import { useMediaMetadata } from "./media-metadata-provider"

interface TMDBTVShowOverviewProps {
    tvShow?: TMDBTVShowDetails
    className?: string
    onOpenMediaSearch?: () => void
}

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

export function TMDBTVShowOverview({ tvShow, className, onOpenMediaSearch }: TMDBTVShowOverviewProps) {
    const { updateMediaMetadata, selectedMediaMetadata } = useMediaMetadata()
    const [searchResults, setSearchResults] = useState<TMDBTVShow[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [searchError, setSearchError] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState(tvShow?.name || "")
    const [isUpdatingTvShow, setIsUpdatingTvShow] = useState(false)
    const [expandedSeasonId, setExpandedSeasonId] = useState<number | null>(null)
    const [expandedEpisodeId, setExpandedEpisodeId] = useState<number | null>(null)
    const { userConfig } = useConfig()

    const posterUrl = tvShow ? getTMDBImageUrl(tvShow.poster_path, "w500") : null
    const backdropUrl = tvShow ? getTMDBImageUrl(tvShow.backdrop_path, "w780") : null
    const formattedDate = tvShow ? formatDate(tvShow.first_air_date) : "N/A"

    // Update search query when tvShow name changes
    useEffect(() => {
        if (tvShow?.name) {
            setSearchQuery(tvShow.name)
        }
    }, [tvShow?.name])

    const handleSearch = useCallback(async () => {
        // Perform search if there's a query
        if (!searchQuery.trim()) {
            setSearchResults([])
            setSearchError(null)
            return
        }

        setIsSearching(true)
        setSearchError(null)
        setSearchResults([])

        try {
            // Get language from user config, default to en-US
            const language = (userConfig?.applicationLanguage || 'en-US') as 'zh-CN' | 'en-US' | 'ja-JP'
            
            // Perform search for TV shows
            const response = await searchTmdb(searchQuery.trim(), 'tv', language)

            if (response.error) {
                setSearchError(response.error)
                setSearchResults([])
                return
            }

            // Filter to only TV shows and map results
            const tvShows = response.results.filter((item): item is TMDBTVShow => 'name' in item)
            setSearchResults(tvShows)

            if (tvShows.length === 0) {
                setSearchError('No results found')
            }
        } catch (error) {
            console.error('Search failed:', error)
            const errorMessage = error instanceof Error ? error.message : 'Failed to search TMDB'
            setSearchError(errorMessage)
            setSearchResults([])
        } finally {
            setIsSearching(false)
        }
    }, [searchQuery, userConfig])

    const handleSelectResult = useCallback(async (result: TMDBTVShow) => {
        if(selectedMediaMetadata?.tmdbTvShow?.id === result.id) {
            return
        }

        if (!selectedMediaMetadata?.mediaFolderPath) {
            console.error("No media metadata path available")
            return
        }

        setIsUpdatingTvShow(true)

        try {
            // Get language from user config, default to en-US
            const language = (userConfig?.applicationLanguage || 'en-US') as 'zh-CN' | 'en-US' | 'ja-JP'
            
            // Fetch full TV show details
            const response = await getTvShowById(result.id, language)

            if (response.error) {
                console.error("Failed to get TV show details:", response.error)
                setIsUpdatingTvShow(false)
                return
            }

            if (!response.data) {
                console.error("No TV show data returned")
                setIsUpdatingTvShow(false)
                return
            }

            // Update media metadata with the new TV show
            updateMediaMetadata(selectedMediaMetadata.mediaFolderPath, {
                ...selectedMediaMetadata,
                tmdbTvShow: response.data,
                tmdbMediaType: 'tv',
                type: 'tvshow-folder',
            })

            setIsUpdatingTvShow(false)
        } catch (error) {
            console.error("Failed to update media metadata:", error)
            setIsUpdatingTvShow(false)
        }
    }, [selectedMediaMetadata, userConfig, updateMediaMetadata])
    
    // When tvShow is undefined, show only ImmersiveSearchbox
    if (!tvShow) {
        return (
            <div className={cn("relative w-full h-full flex flex-col", className)}>
                <div className="relative p-6 flex-1 overflow-y-auto">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <ImmersiveSearchbox
                                value={searchQuery}
                                onChange={setSearchQuery}
                                onSearch={handleSearch}
                                onSelect={handleSelectResult}
                                searchResults={searchResults}
                                isSearching={isSearching}
                                searchError={searchError}
                                placeholder="Enter TV show name"
                                inputClassName="text-3xl font-bold mb-2 block"
                            />
                        </div>
                    </div>
                </div>
            </div>
        )
    }
    
    return (
        <div className={cn("relative w-full h-full overflow-hidden rounded-lg flex flex-col", className)}>
            {/* Backdrop Image */}
            {backdropUrl && (
                <div 
                    className="absolute inset-0 bg-cover bg-center opacity-20 dark:opacity-10"
                    style={{ backgroundImage: `url(${backdropUrl})` }}
                />
            )}
            
            {/* Content Container */}
            <div className="relative p-6 flex-1 overflow-y-auto">
                <div className="flex flex-col md:flex-row gap-6">
                    {/* Poster */}
                    {isUpdatingTvShow ? (
                        <div className="shrink-0">
                            <Skeleton className="w-48 h-[288px] rounded-lg" />
                        </div>
                    ) : posterUrl ? (
                        <div className="shrink-0">
                            <img
                                src={posterUrl}
                                alt={tvShow.name}
                                className="w-48 rounded-lg shadow-lg object-cover"
                            />
                        </div>
                    ) : null}
                    
                    {/* Details */}
                    <div className="flex-1 space-y-4">
                        {/* Title */}
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                                {isUpdatingTvShow ? (
                                    <div className="space-y-2 mb-2">
                                        <Skeleton className="h-9 w-3/4" />
                                        <Skeleton className="h-6 w-1/2" />
                                    </div>
                                ) : (
                                    <>
                                        <ImmersiveSearchbox
                                            value={searchQuery}
                                            onChange={setSearchQuery}
                                            onSearch={handleSearch}
                                            onSelect={handleSelectResult}
                                            searchResults={searchResults}
                                            isSearching={isSearching}
                                            searchError={searchError}
                                            placeholder="Enter TV show name"
                                            inputClassName="text-3xl font-bold mb-2 block"
                                        />
                                        {tvShow.original_name !== tvShow.name && (
                                            <p className="text-muted-foreground text-lg">{tvShow.original_name}</p>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                        
                        {/* Metadata Badges */}
                        {isUpdatingTvShow ? (
                            <div className="flex flex-wrap gap-2">
                                <Skeleton className="h-6 w-32" />
                                <Skeleton className="h-6 w-24" />
                                <Skeleton className="h-6 w-20" />
                                <Skeleton className="h-6 w-28" />
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                <Badge variant="secondary" className="gap-1">
                                    <Calendar className="size-3" />
                                    {formattedDate}
                                </Badge>
                                
                                <Badge variant="secondary" className="gap-1">
                                    <Star className="size-3 fill-yellow-500 text-yellow-500" />
                                    {tvShow.vote_average.toFixed(1)}
                                    <span className="text-xs text-muted-foreground">
                                        ({tvShow.vote_count.toLocaleString()})
                                    </span>
                                </Badge>
                                
                                <Badge variant="secondary" className="gap-1">
                                    <TrendingUp className="size-3" />
                                    {tvShow.popularity.toFixed(0)}
                                </Badge>
                                
                                {tvShow.origin_country && tvShow.origin_country.length > 0 && (
                                    <Badge variant="outline" className="gap-1">
                                        <Globe className="size-3" />
                                        {tvShow.origin_country.join(", ")}
                                    </Badge>
                                )}
                            </div>
                        )}
                        
                        {/* Overview */}
                        {isUpdatingTvShow ? (
                            <div className="space-y-2">
                                <Skeleton className="h-6 w-24" />
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-3/4" />
                            </div>
                        ) : tvShow.overview && (
                            <div className="space-y-2">
                                <h2 className="text-lg font-semibold">Overview</h2>
                                <p className="text-muted-foreground leading-relaxed">{tvShow.overview}</p>
                            </div>
                        )}
                        
                        {/* Genre IDs - Display as badges */}
                        {isUpdatingTvShow ? (
                            <div className="space-y-2">
                                <Skeleton className="h-6 w-20" />
                                <div className="flex flex-wrap gap-2">
                                    <Skeleton className="h-6 w-20" />
                                    <Skeleton className="h-6 w-24" />
                                    <Skeleton className="h-6 w-18" />
                                </div>
                            </div>
                        ) : tvShow.genre_ids && tvShow.genre_ids.length > 0 && (
                            <div className="space-y-2">
                                <h2 className="text-lg font-semibold">Genres</h2>
                                <div className="flex flex-wrap gap-2">
                                    {tvShow.genre_ids.map((genreId) => (
                                        <Badge key={genreId} variant="outline">
                                            Genre {genreId}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        
                    </div>
                </div>


                {/* Seasons */}
                {isUpdatingTvShow ? (
                            <div className="space-y-2">
                                <Skeleton className="h-6 w-24" />
                                <div className="space-y-3">
                                    <Skeleton className="h-32 w-full" />
                                    <Skeleton className="h-32 w-full" />
                                    <Skeleton className="h-32 w-full" />
                                </div>
                            </div>
                        ) : tvShow.seasons && tvShow.seasons.length > 0 && (
                            <div className="space-y-2">
                                <h2 className="text-lg font-semibold flex items-center gap-2">
                                    <Tv className="size-5" />
                                    Seasons ({tvShow.number_of_seasons})
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
                                                                                                <div className="p-2 rounded-md bg-background border">
                                                                                                    <div className="flex items-center gap-2 mb-1">
                                                                                                        <FileVideo className="size-4 text-primary" />
                                                                                                        <span className="text-xs font-semibold">Video File</span>
                                                                                                    </div>
                                                                                                    <p className="text-xs text-muted-foreground font-mono truncate">
                                                                                                        {videoFile.absolutePath}
                                                                                                    </p>
                                                                                                </div>
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
                        )}
            </div>
        </div>
    )
}