import type { TMDBTVShowDetails, TMDBTVShow } from "@core/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, Star, TrendingUp, Globe, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { ImmersiveInput } from "./ImmersiveInput"
import { useCallback, useState, useRef, useEffect } from "react"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { searchTmdb } from "@/api/tmdb"
import { useConfig } from "./config-provider"

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
    if (!tvShow) {
        return (
            <div className={cn("flex items-center justify-center w-full h-full", className)}>
                <div className="text-center space-y-4">
                    <p className="text-muted-foreground">No TV show selected</p>
                    {onOpenMediaSearch && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onOpenMediaSearch}
                        >
                            <Search className="size-4 mr-2" />
                            Search Media
                        </Button>
                    )}
                </div>
            </div>
        )
    }

    const posterUrl = getTMDBImageUrl(tvShow.poster_path, "w500")
    const backdropUrl = getTMDBImageUrl(tvShow.backdrop_path, "w780")
    const formattedDate = formatDate(tvShow.first_air_date)
    const [isSearchOpen, setIsSearchOpen] = useState(false)
    const [popoverWidth, setPopoverWidth] = useState<number | undefined>(undefined)
    const [searchResults, setSearchResults] = useState<TMDBTVShow[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [searchError, setSearchError] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState(tvShow.name || "")
    const inputContainerRef = useRef<HTMLDivElement>(null)
    const { userConfig } = useConfig()

    // Measure input width when popover opens
    useEffect(() => {
        if (isSearchOpen && inputContainerRef.current) {
            const width = inputContainerRef.current.offsetWidth
            setPopoverWidth(width)
        }
    }, [isSearchOpen])

    // Update search query when tvShow name changes
    useEffect(() => {
        if (tvShow.name) {
            setSearchQuery(tvShow.name)
        }
    }, [tvShow.name])

    const handleSearchButtonClick = useCallback(async () => {
        // Prevent popover from closing
        const wasOpen = isSearchOpen
        if (!wasOpen) {
            setIsSearchOpen(true)
        }
        
        // Keep input focused
        setTimeout(() => {
            inputContainerRef.current?.querySelector('input')?.focus()
        }, 0)
        
        // Perform search if there's a query
        if (!searchQuery.trim()) {
            if (!wasOpen) {
                setSearchResults([])
                setSearchError(null)
            }
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

    const handleSelectResult = useCallback((result: TMDBTVShow) => {
        // TODO: Handle result selection - could call a callback prop to update the TV show
        console.log("Selected:", result)
        setIsSearchOpen(false)
    }, [])
    
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
                    {posterUrl && (
                        <div className="shrink-0">
                            <img
                                src={posterUrl}
                                alt={tvShow.name}
                                className="w-48 rounded-lg shadow-lg object-cover"
                            />
                        </div>
                    )}
                    
                    {/* Details */}
                    <div className="flex-1 space-y-4">
                        {/* Title */}
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                                <Popover 
                                    open={isSearchOpen} 
                                    onOpenChange={(open) => {
                                        setIsSearchOpen(open)
                                    }}
                                    modal={false}
                                >
                                    <PopoverAnchor asChild>
                                        <div ref={inputContainerRef}>
                                            <ImmersiveInput 
                                                value={searchQuery} 
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                onSearch={handleSearchButtonClick}
                                                isOpen={isSearchOpen}
                                                className="text-3xl font-bold mb-2 block"
                                                placeholder="Enter TV show name"
                                            />
                                        </div>
                                    </PopoverAnchor>
                                    <PopoverContent 
                                        className="p-0" 
                                        align="start"
                                        side="bottom"
                                        sideOffset={8}
                                        style={{ width: popoverWidth ? `${popoverWidth}px` : undefined }}
                                        onInteractOutside={(e) => {
                                            // Prevent closing when clicking the search button
                                            const target = e.target as HTMLElement
                                            if (inputContainerRef.current?.contains(target)) {
                                                e.preventDefault()
                                            }
                                        }}
                                    >
                                        <ScrollArea className="max-h-[400px]">
                                            <div className="p-2">
                                                {isSearching ? (
                                                    <div className="flex items-center justify-center h-32">
                                                        <div className="text-muted-foreground">Searching...</div>
                                                    </div>
                                                ) : searchError ? (
                                                    <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                                                        {searchError}
                                                    </div>
                                                ) : searchResults.length > 0 ? (
                                                    searchResults.map((result) => {
                                                        const resultPosterUrl = getTMDBImageUrl(result.poster_path, "w200")
                                                        return (
                                                            <div
                                                                key={result.id}
                                                                onClick={() => handleSelectResult(result)}
                                                                className="flex gap-3 p-3 rounded-md cursor-pointer hover:bg-accent transition-colors"
                                                            >
                                                                {resultPosterUrl && (
                                                                    <div className="shrink-0">
                                                                        <img
                                                                            src={resultPosterUrl}
                                                                            alt={result.name}
                                                                            className="w-16 h-24 object-cover rounded-md bg-muted"
                                                                            onError={(e) => {
                                                                                const target = e.target as HTMLImageElement
                                                                                target.style.display = "none"
                                                                            }}
                                                                        />
                                                                    </div>
                                                                )}
                                                                <div className="flex-1 min-w-0">
                                                                    <h3 className="font-semibold text-base mb-1">
                                                                        {result.name}
                                                                    </h3>
                                                                    {result.original_name !== result.name && (
                                                                        <p className="text-sm text-muted-foreground mb-1">
                                                                            {result.original_name}
                                                                        </p>
                                                                    )}
                                                                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                                                        {result.overview || 'No overview available'}
                                                                    </p>
                                                                    {(result.first_air_date || result.vote_average) && (
                                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                                            {result.first_air_date && (
                                                                                <span>{formatDate(result.first_air_date)}</span>
                                                                            )}
                                                                            {result.first_air_date && result.vote_average && (
                                                                                <span>•</span>
                                                                            )}
                                                                            {result.vote_average > 0 && (
                                                                                <span className="flex items-center gap-1">
                                                                                    <Star className="size-3 fill-yellow-500 text-yellow-500" />
                                                                                    {result.vote_average.toFixed(1)}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )
                                                    })
                                                ) : (
                                                    <div className="flex items-center justify-center h-32 text-muted-foreground">
                                                        {searchQuery.trim() ? 'No results found' : 'Enter a search query and click search'}
                                                    </div>
                                                )}
                                            </div>
                                        </ScrollArea>
                                    </PopoverContent>
                                </Popover>
                                {tvShow.original_name !== tvShow.name && (
                                    <p className="text-muted-foreground text-lg">{tvShow.original_name}</p>
                                )}
                            </div>
                        </div>
                        
                        {/* Metadata Badges */}
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
                        
                        {/* Overview */}
                        {tvShow.overview && (
                            <div className="space-y-2">
                                <h2 className="text-lg font-semibold">Overview</h2>
                                <p className="text-muted-foreground leading-relaxed">{tvShow.overview}</p>
                            </div>
                        )}
                        
                        {/* Genre IDs - Display as badges */}
                        {tvShow.genre_ids && tvShow.genre_ids.length > 0 && (
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
            </div>
        </div>
    )
}