import type { TMDBTVShow, TMDBMovie } from "@core/types"
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"
import { Badge } from "@/components/ui/badge"
import { Calendar, Star, TrendingUp, Globe, FileEdit, Download, Scan } from "lucide-react"
import { TMDBSearchbox } from "./TMDBSearchbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "./ui/button"
import { useTranslation } from "@/lib/i18n"

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

function getTMDBImageUrl(path: string | null, size: "w200" | "w300" | "w500" | "w780" | "original" = "w500"): string | null {
    if (!path) return null
    const baseUrl = "https://image.tmdb.org/t/p"
    return `${baseUrl}/${size}${path}`
}

interface TVShowHeaderProps {
    onSearchResultSelected: (result: TMDBTVShow | TMDBMovie) => void
    onRecognizeButtonClick?: () => void
    onRenameClick?: () => void
    selectedMediaMetadata?: UIMediaMetadata
    openScrape?: (params: { mediaMetadata: UIMediaMetadata }) => void
}

export function TVShowHeader({
    onSearchResultSelected,
    onRecognizeButtonClick,
    onRenameClick,
    selectedMediaMetadata,
    openScrape,
}: TVShowHeaderProps) {
    const { t } = useTranslation(['components', 'errors', 'dialogs'])

    const tvShow = selectedMediaMetadata?.tmdbTvShow
    const isUpdatingTvShow = selectedMediaMetadata?.status === 'updating'
    const initialSearchValue = tvShow?.name

    const posterUrl = tvShow ? getTMDBImageUrl(tvShow.poster_path, "w500") : null
    const formattedDate = tvShow ? formatDate(tvShow.first_air_date) : t('tvShow.notAvailable', { ns: 'components' })

    return (
        <div className="relative w-full">
            <div className="relative flex flex-col md:flex-row gap-6">
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
                
                <div className="flex-1 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            {isUpdatingTvShow ? (
                                <div className="space-y-2 mb-2">
                                    <Skeleton className="h-9 w-3/4" />
                                    <Skeleton className="h-6 w-1/2" />
                                </div>
                            ) : (
                                <>
                                    <TMDBSearchbox
                                        mediaType="tv"
                                        value={initialSearchValue}
                                        onSearchResultSelected={onSearchResultSelected}
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
                                    
                                    openScrape?.({
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
        </div>
    )
}
