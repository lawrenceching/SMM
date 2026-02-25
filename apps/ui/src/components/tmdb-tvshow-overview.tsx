import type { TMDBTVShowDetails, TMDBTVShow } from "@core/types"
import { cn, nextTraceId } from "@/lib/utils"
import { ImmersiveSearchbox } from "./ImmersiveSearchbox"
import { useCallback, useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react"
import { searchTmdb, getTvShowById } from "@/api/tmdb"
import { useConfig } from "@/providers/config-provider"
import { useMediaMetadata } from "@/providers/media-metadata-provider"
import { SeasonSection } from "./season-section"
import { useDialogs } from "@/providers/dialog-provider"
import type { SeasonModel } from "./TvShowPanel"
import { useTranslation } from "@/lib/i18n"
import { TVShowHeader } from "./tv-show-header"

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
    isPreviewingForRename: boolean
    /** True when user is reviewing match between local video file and episode; UI should highlight the video file path. */
    isPreviewingForRecognize?: boolean
    scrollToEpisodeId?: number | null
    onEpisodeFileSelect?: (episode: import("@core/types").TMDBEpisode) => void
    isLoading?: boolean
}

function getTMDBImageUrl(path: string | null, size: "w200" | "w300" | "w500" | "w780" | "original" = "w500"): string | null {
    if (!path) return null
    const baseUrl = "https://image.tmdb.org/t/p"
    return `${baseUrl}/${size}${path}`
}

export const TMDBTVShowOverview = forwardRef<TMDBTVShowOverviewRef, TMDBTVShowOverviewProps>(
    ({ tvShow, className, onRenameClick, onRecognizeButtonClick, ruleName, 
        seasons, isPreviewingForRename, isPreviewingForRecognize = false, scrollToEpisodeId, onEpisodeFileSelect, isLoading }, ref) => {
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

    const backdropUrl = tvShow ? getTMDBImageUrl(tvShow.backdrop_path, "w780") : null

    const { scrapeDialog } = useDialogs()
    const [openScrape] = scrapeDialog

    // Expand all seasons and episodes when preview mode is entered, save current state
    useEffect(() => {
        const wasInPreviewMode = prevPreviewModeRef.current
        prevPreviewModeRef.current = isPreviewingForRename

        if (isPreviewingForRename && !wasInPreviewMode && tvShow?.seasons) {
            // Entering preview mode: save current expand state before expanding all
            // Use functional updates to get the current state values
            setExpandedSeasonIds(currentSeasonIds => {
                savedSeasonIdsRef.current = new Set(currentSeasonIds)
                // Expand all seasons (including season 0 / specials) for preview
                const seasonIds = new Set(tvShow.seasons!.map(season => season.id))
                return seasonIds
            })

            setExpandedEpisodeIds(currentEpisodeIds => {
                savedEpisodeIdsRef.current = new Set(currentEpisodeIds)
                // Expand all episodes (including season 0)
                const episodeIds = new Set<number>()
                tvShow.seasons!.forEach(season => {
                    if (season.episodes) {
                        season.episodes.forEach(episode => {
                            episodeIds.add(episode.id)
                        })
                    }
                })
                return episodeIds
            })
        } else if (!isPreviewingForRename && wasInPreviewMode && savedSeasonIdsRef.current !== null && savedEpisodeIdsRef.current !== null) {
            // Exiting preview mode: restore saved state
            setExpandedSeasonIds(savedSeasonIdsRef.current)
            setExpandedEpisodeIds(savedEpisodeIdsRef.current)
            // Clear saved state
            savedSeasonIdsRef.current = null
            savedEpisodeIdsRef.current = null
        }
    }, [isPreviewingForRename, tvShow])

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
            const traceId = `tmdb-tvshow-overview-handleSelectResult-${nextTraceId()}`
            updateMediaMetadata(selectedMediaMetadata.mediaFolderPath, {
                ...selectedMediaMetadata,
                tmdbTvShow: response.data,
                tmdbMediaType: 'tv',
                type: 'tvshow-folder',
            }, { traceId })

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
            {backdropUrl && (
                <div 
                    className="absolute inset-0 bg-cover bg-center opacity-20 dark:opacity-10"
                    style={{ backgroundImage: `url(${backdropUrl})` }}
                />
            )}
            <div className="relative p-6 flex-1 overflow-y-auto space-y-6">
                <TVShowHeader
                    tvShow={tvShow}
                    isUpdatingTvShow={isUpdatingTvShow}
                    isSearching={isSearching}
                    searchError={searchError}
                    searchQuery={searchQuery}
                    searchResults={searchResults}
                    onSearchQueryChange={setSearchQuery}
                    onSearch={handleSearch}
                    onSelectResult={handleSelectResult}
                    onRecognizeButtonClick={onRecognizeButtonClick}
                    onRenameClick={onRenameClick}
                    selectedMediaMetadata={selectedMediaMetadata}
                    openScrape={openScrape}
                />

                {/* Seasons */}
                <SeasonSection
                    tvShow={tvShow}
                    isUpdatingTvShow={isUpdatingTvShow || (isLoading ?? false)}
                    expandedSeasonIds={expandedSeasonIds}
                    setExpandedSeasonIds={setExpandedSeasonIds}
                    expandedEpisodeIds={expandedEpisodeIds}
                    setExpandedEpisodeIds={setExpandedEpisodeIds}
                    isPreviewingForRename={isPreviewingForRename}
                    isPreviewingForRecognize={isPreviewingForRecognize}
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