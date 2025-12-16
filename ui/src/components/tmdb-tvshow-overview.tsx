import type { TMDBTVShowDetails } from "@core/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, Star, TrendingUp, Globe, Search } from "lucide-react"
import { cn } from "@/lib/utils"

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
                            <div>
                                <h1 className="text-3xl font-bold mb-2">{tvShow.name}</h1>
                                {tvShow.original_name !== tvShow.name && (
                                    <p className="text-muted-foreground text-lg">{tvShow.original_name}</p>
                                )}
                            </div>
                            {onOpenMediaSearch && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={onOpenMediaSearch}
                                    className="shrink-0"
                                >
                                    <Search className="size-4 mr-2" />
                                    Search Media
                                </Button>
                            )}
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