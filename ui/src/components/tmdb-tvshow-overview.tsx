import type { TMDBTVShowDetails, TMDBTVShow } from "@core/types"
import { Badge } from "@/components/ui/badge"
import { Calendar, Star, TrendingUp, Globe, FileEdit, Download, Scan } from "lucide-react"
import { cn } from "@/lib/utils"
import { ImmersiveSearchbox } from "./ImmersiveSearchbox"
import { useCallback, useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { searchTmdb, getTvShowById } from "@/api/tmdb"
import { useConfig } from "./config-provider"
import { useMediaMetadata } from "./media-metadata-provider"
import { Button } from "./ui/button"
import { SeasonSection } from "./season-section"
import { useDialogs } from "./dialog-provider"
import type { SeasonModel } from "./TvShowPanel"
import { useTranslation } from "@/lib/i18n"

export interface TMDBTVShowOverviewRef {
    handleSelectResult: (result: TMDBTVShow) => Promise<void>
}

interface TMDBTVShowOverviewProps {
    tvShow?: TMDBTVShowDetails
    className?: string
    onRenameClick?: () => void
    onRecognizeButtonClick?: () => void
    ruleName?: "plex" | "emby"
    seasons: SeasonModel[]
    isPreviewMode: boolean
    scrollToEpisodeId?: number | null
    onEpisodeFileSelect?: (episode: import("@core/types").TMDBEpisode) => void
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

export const TMDBTVShowOverview = forwardRef<TMDBTVShowOverviewRef, TMDBTVShowOverviewProps>(
    ({ tvShow, className, onRenameClick, onRecognizeButtonClick, ruleName, seasons, isPreviewMode, scrollToEpisodeId, onEpisodeFileSelect }, ref) => {
    const { t } = useTranslation(['components', 'errors', 'dialogs'])
    const { updateMediaMetadata, selectedMediaMetadata } = useMediaMetadata()
    const [searchResults, setSearchResults] = useState<TMDBTVShow[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [searchError, setSearchError] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [isUpdatingTvShow, setIsUpdatingTvShow] = useState(false)
    const [expandedSeasonIds, setExpandedSeasonIds] = useState<Set<number>>(new Set())
    const [expandedEpisodeIds, setExpandedEpisodeIds] = useState<Set<number>>(new Set())
    const savedSeasonIdsRef = useRef<Set<number> | null>(null)
    const savedEpisodeIdsRef = useRef<Set<number> | null>(null)
    const prevPreviewModeRef = useRef(false)
    const { userConfig } = useConfig()

    const { scrapeDialog } = useDialogs()
    const [openScrape] = scrapeDialog

    // Expand all seasons and episodes when preview mode is entered, save current state
    useEffect(() => {
        const wasInPreviewMode = prevPreviewModeRef.current
        prevPreviewModeRef.current = isPreviewMode

        if (isPreviewMode && !wasInPreviewMode && tvShow?.seasons) {
            // Entering preview mode: save current expand state before expanding all
            // Use functional updates to get the current state values
            setExpandedSeasonIds(currentSeasonIds => {
                savedSeasonIdsRef.current = new Set(currentSeasonIds)
                // Expand all seasons (filter out season 0)
                const seasonIds = new Set(
                    tvShow.seasons!
                        .filter(season => season.season_number > 0)
                        .map(season => season.id)
                )
                return seasonIds
            })

            setExpandedEpisodeIds(currentEpisodeIds => {
                savedEpisodeIdsRef.current = new Set(currentEpisodeIds)
                // Expand all episodes
                const episodeIds = new Set<number>()
                tvShow.seasons!.forEach(season => {
                    if (season.episodes && season.season_number > 0) {
                        season.episodes.forEach(episode => {
                            episodeIds.add(episode.id)
                        })
                    }
                })
                return episodeIds
            })
        } else if (!isPreviewMode && wasInPreviewMode && savedSeasonIdsRef.current !== null && savedEpisodeIdsRef.current !== null) {
            // Exiting preview mode: restore saved state
            setExpandedSeasonIds(savedSeasonIdsRef.current)
            setExpandedEpisodeIds(savedEpisodeIdsRef.current)
            // Clear saved state
            savedSeasonIdsRef.current = null
            savedEpisodeIdsRef.current = null
        }
    }, [isPreviewMode, tvShow])

    // Handle scrolling to episode when scrollToEpisodeId changes
    useEffect(() => {
        if (scrollToEpisodeId === null || scrollToEpisodeId === undefined || !tvShow?.seasons) {
            return
        }

        // Find the season and episode containing this episode ID
        let targetSeasonId: number | null = null
        for (const season of tvShow.seasons) {
            if (season.episodes) {
                const episode = season.episodes.find(ep => ep.id === scrollToEpisodeId)
                if (episode) {
                    targetSeasonId = season.id
                    break
                }
            }
        }

        if (targetSeasonId === null) {
            console.warn(`[TMDBTVShowOverview] Episode with ID ${scrollToEpisodeId} not found`)
            return
        }

        // Expand the season
        setExpandedSeasonIds(prev => {
            const newSet = new Set(prev)
            newSet.add(targetSeasonId!)
            return newSet
        })

        // Expand the episode
        setExpandedEpisodeIds(prev => {
            const newSet = new Set(prev)
            newSet.add(scrollToEpisodeId!)
            return newSet
        })

        // Wait for DOM to update, then scroll to the episode
        // Use setTimeout to ensure the expansion has rendered
        const timeoutId = setTimeout(() => {
            const episodeElement = document.querySelector(`[data-episode-id="${scrollToEpisodeId}"]`)
            if (episodeElement) {
                episodeElement.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center',
                    inline: 'nearest'
                })
            } else {
                console.warn(`[TMDBTVShowOverview] Episode element with ID ${scrollToEpisodeId} not found in DOM`)
            }
        }, 100) // Small delay to ensure expansion has rendered

        return () => {
            clearTimeout(timeoutId)
        }
    }, [scrollToEpisodeId, tvShow, setExpandedSeasonIds, setExpandedEpisodeIds])

    const posterUrl = tvShow ? getTMDBImageUrl(tvShow.poster_path, "w500") : null
    const backdropUrl = tvShow ? getTMDBImageUrl(tvShow.backdrop_path, "w780") : null
    const formattedDate = tvShow ? formatDate(tvShow.first_air_date) : t('tvShow.notAvailable', { ns: 'components' })

    // Update search query when tvShow name changes
    useEffect(() => {
        if (tvShow?.name) {
            setSearchQuery(tvShow.name)
        } else {
            setSearchQuery("")
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
                setSearchError(t('errors:searchNoResults'))
            }
        } catch (error) {
            console.error('Search failed:', error)
            const errorMessage = error instanceof Error ? error.message : t('errors:searchFailed')
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

    // Expose handleSelectResult via ref
    useImperativeHandle(ref, () => ({
        handleSelectResult
    }), [handleSelectResult])
    
    // When tvShow is undefined, show only ImmersiveSearchbox
    if (!tvShow && !isUpdatingTvShow) {
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
                                placeholder={t('tvShow.searchPlaceholderUnrecognized', { ns: 'components' })}
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
                                alt={tvShow?.name}
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
                                            placeholder={t('tvShow.searchPlaceholder', { ns: 'components' })}
                                            inputClassName="text-3xl font-bold mb-2 block"
                                        />
                                        {tvShow?.original_name !== tvShow?.name && (
                                            <p className="text-muted-foreground text-lg">{tvShow?.original_name}</p>
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
                                    {tvShow?.vote_average.toFixed(1)}
                                    <span className="text-xs text-muted-foreground">
                                        ({tvShow?.vote_count.toLocaleString()})
                                    </span>
                                </Badge>
                                
                                <Badge variant="secondary" className="gap-1">
                                    <TrendingUp className="size-3" />
                                    {tvShow?.popularity.toFixed(0)}
                                </Badge>
                                
                                {tvShow?.origin_country && tvShow?.origin_country.length > 0 && (
                                    <Badge variant="outline" className="gap-1">
                                        <Globe className="size-3" />
                                        {tvShow?.origin_country.join(", ")}
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
                        ) : tvShow?.overview && (
                            <div className="space-y-2">
                                <h2 className="text-lg font-semibold">{t('tvShow.overview', { ns: 'components' })}</h2>
                                <p className="text-muted-foreground leading-relaxed">{tvShow?.overview}</p>
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
                        ) : tvShow?.genre_ids && tvShow?.genre_ids.length > 0 && (
                            <div className="space-y-2">
                                <h2 className="text-lg font-semibold">{t('tvShow.genres', { ns: 'components' })}</h2>
                                <div className="flex flex-wrap gap-2">
                                    {tvShow?.genre_ids.map((genreId) => (
                                        <Badge key={genreId} variant="outline">
                                            {t('tvShow.genreLabel', { ns: 'components', genreId })}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {/* Action Buttons */}
                        {isUpdatingTvShow ? (
                            <div className="flex gap-2 flex-wrap">
                                <Skeleton className="h-9 w-32" />
                                <Skeleton className="h-9 w-24" />
                                <Skeleton className="h-9 w-28" />
                            </div>
                        ) : (
                            <div className="flex gap-2 flex-wrap">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        onRecognizeButtonClick?.()
                                    }}
                                >
                                    <Scan className="size-4 mr-2" />
                                    {t('tvShow.recognize', { ns: 'components', defaultValue: 'Recognize' })}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        onRenameClick?.()
                                    }}
                                >
                                    <FileEdit className="size-4 mr-2" />
                                    {t('tvShow.rename', { ns: 'components' })}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        if (!selectedMediaMetadata?.mediaFiles || !selectedMediaMetadata.tmdbTvShow) return
                                        
                                        // Open the task progress dialog with Start button
                                        openScrape({
                                            mediaMetadata: selectedMediaMetadata
                                        })
                                    }}
                                    disabled={!selectedMediaMetadata?.mediaFiles || selectedMediaMetadata.mediaFiles.length === 0}
                                >
                                    <Download className="size-4 mr-2" />
                                    {t('tvShow.scrape', { ns: 'components' })}
                                </Button>
                            </div>
                        )}
                        
                    </div>
                </div>


                {/* Seasons */}
                <SeasonSection
                    tvShow={tvShow}
                    isUpdatingTvShow={isUpdatingTvShow}
                    expandedSeasonIds={expandedSeasonIds}
                    setExpandedSeasonIds={setExpandedSeasonIds}
                    expandedEpisodeIds={expandedEpisodeIds}
                    setExpandedEpisodeIds={setExpandedEpisodeIds}
                    isPreviewMode={isPreviewMode}
                    ruleName={ruleName}
                    seasons={seasons}
                    scrollToEpisodeId={scrollToEpisodeId}
                    onEpisodeFileSelect={onEpisodeFileSelect}
                />
            </div>
        </div>
    )
})

TMDBTVShowOverview.displayName = 'TMDBTVShowOverview'