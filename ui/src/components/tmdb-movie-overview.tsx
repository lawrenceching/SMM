import type { TMDBMovie } from "@core/types"
import { Badge } from "@/components/ui/badge"
import { Calendar, Star, TrendingUp, FileEdit, Download } from "lucide-react"
import { cn } from "@/lib/utils"
import { ImmersiveMovieSearchbox } from "./ImmersiveMovieSearchbox"
import { useCallback, useState, useEffect } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { searchTmdb } from "@/api/tmdb"
import { useConfig } from "./config-provider"
import { useMediaMetadata } from "./media-metadata-provider"
import { Button } from "./ui/button"
import { useDialogs } from "./dialog-provider"
import type { Task } from "./dialog-provider"
import { scrapeApi } from "@/api/scrape"
import type { MovieFileModel } from "./MoviePanel"
import { MovieFilesSection } from "./movie-files-section"

interface TMDBMovieOverviewProps {
    movie?: TMDBMovie
    className?: string
    onRenameClick?: () => void
    ruleName?: "plex" | "emby"
    movieFiles: MovieFileModel
    isPreviewMode: boolean
    setIsPreviewMode: React.Dispatch<React.SetStateAction<boolean>>
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

export function TMDBMovieOverview({ movie, className, onRenameClick, ruleName, movieFiles, isPreviewMode, setIsPreviewMode }: TMDBMovieOverviewProps) {
    const { updateMediaMetadata, selectedMediaMetadata, refreshMediaMetadata } = useMediaMetadata()
    const [searchResults, setSearchResults] = useState<TMDBMovie[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [searchError, setSearchError] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [isUpdatingMovie, setIsUpdatingMovie] = useState(false)
    const { userConfig } = useConfig()
    const { scrapeDialog } = useDialogs()
    const [openScrape, , updateTasks] = scrapeDialog

    useEffect(() => {
        setIsPreviewMode(false)
    }, [selectedMediaMetadata, setIsPreviewMode])

    // Exit preview mode when ruleName becomes undefined (toolbar closed/canceled)
    useEffect(() => {
        if (!ruleName) {
            setIsPreviewMode(false)
        }
    }, [ruleName])

    const posterUrl = movie ? getTMDBImageUrl(movie.poster_path, "w500") : null
    const backdropUrl = movie ? getTMDBImageUrl(movie.backdrop_path, "w780") : null
    const formattedDate = movie ? formatDate(movie.release_date) : "N/A"

    // Update search query when movie title changes
    useEffect(() => {
        if (movie?.title) {
            setSearchQuery(movie.title)
        } else {
            setSearchQuery("")
        }
    }, [movie?.title])

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
            
            // Perform search for movies
            const response = await searchTmdb(searchQuery.trim(), 'movie', language)

            if (response.error) {
                setSearchError(response.error)
                setSearchResults([])
                return
            }

            // Filter to only movies and map results
            const movies = response.results.filter((item): item is TMDBMovie => 'title' in item)
            setSearchResults(movies)

            if (movies.length === 0) {
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

    const handleSelectResult = useCallback(async (result: TMDBMovie) => {
        if(selectedMediaMetadata?.tmdbMovie?.id === result.id) {
            return
        }

        if (!selectedMediaMetadata?.mediaFolderPath) {
            console.error("No media metadata path available")
            return
        }

        setIsUpdatingMovie(true)

        try {
            // For now, just update with the search result
            // In a real implementation, you might want to fetch full movie details
            updateMediaMetadata(selectedMediaMetadata.mediaFolderPath, {
                ...selectedMediaMetadata,
                tmdbMovie: result,
                tmdbMediaType: 'movie',
                type: 'movie-folder',
            })

            setIsUpdatingMovie(false)
        } catch (error) {
            console.error("Failed to update media metadata:", error)
            setIsUpdatingMovie(false)
        }
    }, [selectedMediaMetadata, updateMediaMetadata])
    
    // When movie is undefined, show only ImmersiveMovieSearchbox
    if (!movie && !isUpdatingMovie) {
        return (
            <div className={cn("relative w-full h-full flex flex-col", className)}>
                <div className="relative p-6 flex-1 overflow-y-auto">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <ImmersiveMovieSearchbox
                                value={searchQuery}
                                onChange={setSearchQuery}
                                onSearch={handleSearch}
                                onSelect={handleSelectResult}
                                searchResults={searchResults}
                                isSearching={isSearching}
                                searchError={searchError}
                                placeholder="未识别媒体库, 请在此处输入并搜索电影"
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
                    {isUpdatingMovie ? (
                        <div className="shrink-0">
                            <Skeleton className="w-48 h-[288px] rounded-lg" />
                        </div>
                    ) : posterUrl ? (
                        <div className="shrink-0">
                            <img
                                src={posterUrl}
                                alt={movie?.title}
                                className="w-48 rounded-lg shadow-lg object-cover"
                            />
                        </div>
                    ) : null}
                    
                    {/* Details */}
                    <div className="flex-1 space-y-4">
                        {/* Title */}
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                                {isUpdatingMovie ? (
                                    <div className="space-y-2 mb-2">
                                        <Skeleton className="h-9 w-3/4" />
                                        <Skeleton className="h-6 w-1/2" />
                                    </div>
                                ) : (
                                    <>
                                        <ImmersiveMovieSearchbox
                                            value={searchQuery}
                                            onChange={setSearchQuery}
                                            onSearch={handleSearch}
                                            onSelect={handleSelectResult}
                                            searchResults={searchResults}
                                            isSearching={isSearching}
                                            searchError={searchError}
                                            placeholder="Enter movie name"
                                            inputClassName="text-3xl font-bold mb-2 block"
                                        />
                                        {movie?.original_title !== movie?.title && (
                                            <p className="text-muted-foreground text-lg">{movie?.original_title}</p>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                        
                        {/* Metadata Badges */}
                        {isUpdatingMovie ? (
                            <div className="flex flex-wrap gap-2">
                                <Skeleton className="h-6 w-32" />
                                <Skeleton className="h-6 w-24" />
                                <Skeleton className="h-6 w-20" />
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                <Badge variant="secondary" className="gap-1">
                                    <Calendar className="size-3" />
                                    {formattedDate}
                                </Badge>
                                
                                <Badge variant="secondary" className="gap-1">
                                    <Star className="size-3 fill-yellow-500 text-yellow-500" />
                                    {movie?.vote_average.toFixed(1)}
                                    <span className="text-xs text-muted-foreground">
                                        ({movie?.vote_count.toLocaleString()})
                                    </span>
                                </Badge>
                                
                                <Badge variant="secondary" className="gap-1">
                                    <TrendingUp className="size-3" />
                                    {movie?.popularity.toFixed(0)}
                                </Badge>
                            </div>
                        )}
                        
                        {/* Overview */}
                        {isUpdatingMovie ? (
                            <div className="space-y-2">
                                <Skeleton className="h-6 w-24" />
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-3/4" />
                            </div>
                        ) : movie?.overview && (
                            <div className="space-y-2">
                                <h2 className="text-lg font-semibold">Overview</h2>
                                <p className="text-muted-foreground leading-relaxed">{movie?.overview}</p>
                            </div>
                        )}
                        
                        {/* Genre IDs - Display as badges */}
                        {isUpdatingMovie ? (
                            <div className="space-y-2">
                                <Skeleton className="h-6 w-20" />
                                <div className="flex flex-wrap gap-2">
                                    <Skeleton className="h-6 w-20" />
                                    <Skeleton className="h-6 w-24" />
                                    <Skeleton className="h-6 w-18" />
                                </div>
                            </div>
                        ) : movie?.genre_ids && movie?.genre_ids.length > 0 && (
                            <div className="space-y-2">
                                <h2 className="text-lg font-semibold">Genres</h2>
                                <div className="flex flex-wrap gap-2">
                                    {movie?.genre_ids.map((genreId) => (
                                        <Badge key={genreId} variant="outline">
                                            Genre {genreId}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {/* Action Buttons */}
                        {isUpdatingMovie ? (
                            <div className="flex gap-2 flex-wrap">
                                <Skeleton className="h-9 w-32" />
                                <Skeleton className="h-9 w-24" />
                            </div>
                        ) : (
                            <div className="flex gap-2 flex-wrap">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setIsPreviewMode(true)
                                        onRenameClick?.()
                                    }}
                                >
                                    <FileEdit className="size-4 mr-2" />
                                    Rename
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        if (!selectedMediaMetadata?.mediaFiles || !selectedMediaMetadata.tmdbMovie) return
                                        
                                        // Create initial tasks for scraping
                                        const initialTasks: Task[] = [
                                            {
                                                name: "Poster",
                                                status: "pending" as const
                                            },
                                            {
                                                name: "Thumbnails",
                                                status: "pending" as const
                                            },
                                            {
                                                name: "nfo",
                                                status: "pending" as const
                                            }
                                        ]
                                        
                                        // Open the task progress dialog with Start button
                                        openScrape(initialTasks, {
                                            title: "Scrape Media",
                                            description: "Download poster, thumbnails, and nfo files",
                                            onStart: async () => {
                                                if (!selectedMediaMetadata?.mediaFolderPath) {
                                                    console.error("No media folder path available")
                                                    return
                                                }

                                                // Update all tasks to running
                                                updateTasks(initialTasks.map(task => ({
                                                    ...task,
                                                    status: "running" as const
                                                })))

                                                try {
                                                    // Call the scrape API
                                                    const response = await scrapeApi(selectedMediaMetadata.mediaFolderPath)
                                                    
                                                    if (response.error) {
                                                        // All tasks failed
                                                        updateTasks(initialTasks.map(task => ({
                                                            ...task,
                                                            status: "failed" as const
                                                        })))
                                                        console.error("Scrape failed:", response.error)
                                                    } else {
                                                        // All tasks completed successfully
                                                        updateTasks(initialTasks.map(task => ({
                                                            ...task,
                                                            status: "completed" as const
                                                        })))
                                                        console.log("Scrape completed successfully")
                                                        
                                                        // Refresh media metadata after successful scrape
                                                        refreshMediaMetadata(selectedMediaMetadata.mediaFolderPath)
                                                    }
                                                } catch (error) {
                                                    // All tasks failed
                                                    updateTasks(initialTasks.map(task => ({
                                                        ...task,
                                                        status: "failed" as const
                                                    })))
                                                    console.error("Scrape error:", error)
                                                }
                                            }
                                        })
                                    }}
                                    disabled={!selectedMediaMetadata?.mediaFiles || selectedMediaMetadata.mediaFiles.length === 0}
                                >
                                    <Download className="size-4 mr-2" />
                                    Scrape
                                </Button>
                            </div>
                        )}
                        
                    </div>
                </div>

                {/* Movie Files */}
                <MovieFilesSection
                    movie={movie}
                    isUpdatingMovie={isUpdatingMovie}
                    isPreviewMode={isPreviewMode}
                    movieFiles={movieFiles}
                />
            </div>
        </div>
    )
}
