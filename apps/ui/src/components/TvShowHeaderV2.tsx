import type { TMDBTVShow, TMDBMovie } from "@core/types"
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"
import { FileEdit, Download, Scan, MoreVertical, ExternalLink, List, LayoutGrid } from "lucide-react"
import { TMDBSearchbox } from "./TMDBSearchbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "./ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export type EpisodeTableLayout = "simple" | "detail"

export interface TvShowHeaderV2Props {
    onSearchResultSelected: (result: TMDBTVShow | TMDBMovie) => void
    onRecognizeButtonClick?: () => void
    onRenameClick?: () => void
    selectedMediaMetadata?: UIMediaMetadata
    openScrape?: (params: { mediaMetadata: UIMediaMetadata }) => void
    episodeTableLayout?: EpisodeTableLayout
    onEpisodeTableLayoutChange?: (layout: EpisodeTableLayout) => void
}

export function TvShowHeaderV2({
    onSearchResultSelected,
    onRecognizeButtonClick,
    onRenameClick,
    selectedMediaMetadata,
    openScrape,
    episodeTableLayout = "simple",
    onEpisodeTableLayoutChange,
}: TvShowHeaderV2Props) {
    const { t } = useTranslation(['components', 'errors', 'dialogs'])

    const tvShow = selectedMediaMetadata?.tmdbTvShow
    const movie = selectedMediaMetadata?.tmdbMovie
    const isUpdatingTvShow = selectedMediaMetadata?.status === 'updating'
    const initialSearchValue = tvShow?.name

    const tmdbId = tvShow?.id ?? movie?.id
    const hasTmdbId = tmdbId != null
    const tmdbUrl = hasTmdbId
        ? tvShow?.id != null
            ? `https://www.themoviedb.org/tv/${tmdbId}`
            : `https://www.themoviedb.org/movie/${tmdbId}`
        : undefined

    return (
        <div className="relative w-full space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="flex-1 min-w-0">
                    {isUpdatingTvShow ? (
                        <Skeleton className="h-9 w-full max-w-md" />
                    ) : (
                        <TMDBSearchbox
                            mediaType="tv"
                            value={initialSearchValue}
                            onSearchResultSelected={onSearchResultSelected}
                            placeholder={t('tvShow.searchPlaceholder', { ns: 'components' })}
                            inputClassName="text-lg font-semibold"
                        />
                    )}
                </div>
                <div className="flex gap-2 flex-wrap shrink-0 items-center">
                    {onEpisodeTableLayoutChange && (
                        <div className="inline-flex items-center rounded-md border border-input bg-background shadow-xs">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onEpisodeTableLayoutChange("simple")}
                                disabled={isUpdatingTvShow}
                                className={cn(
                                    "h-9 w-9 rounded-none rounded-l-md transition-all",
                                    episodeTableLayout === "simple"
                                        ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20"
                                        : "hover:bg-accent hover:text-accent-foreground"
                                )}
                                title={t('tvShow.layoutSimple', { ns: 'components', defaultValue: 'Simple layout' })}
                                aria-label={t('tvShow.layoutSimple', { ns: 'components', defaultValue: 'Simple layout' })}
                                aria-pressed={episodeTableLayout === "simple"}
                            >
                                <List className="size-4" />
                            </Button>
                            <div className="h-4 w-px bg-border" />
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onEpisodeTableLayoutChange("detail")}
                                disabled={isUpdatingTvShow}
                                className={cn(
                                    "h-9 w-9 rounded-none rounded-r-md transition-all",
                                    episodeTableLayout === "detail"
                                        ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20"
                                        : "hover:bg-accent hover:text-accent-foreground"
                                )}
                                title={t('tvShow.layoutDetail', { ns: 'components', defaultValue: 'Detail layout' })}
                                aria-label={t('tvShow.layoutDetail', { ns: 'components', defaultValue: 'Detail layout' })}
                                aria-pressed={episodeTableLayout === "detail"}
                            >
                                <LayoutGrid className="size-4" />
                            </Button>
                        </div>
                    )}
                    {isUpdatingTvShow ? (
                        <>
                            <Skeleton className="h-9 w-28" />
                            <Skeleton className="h-9 w-24" />
                            <Skeleton className="h-9 w-24" />
                        </>
                    ) : (
                        <>
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
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="size-9 shrink-0"
                                        disabled={!hasTmdbId}
                                        aria-label={t('tvShow.more', { ns: 'components', defaultValue: 'More' })}
                                    >
                                        <MoreVertical className="size-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                        disabled={!tmdbUrl}
                                        onClick={() => tmdbUrl && window.open(tmdbUrl, '_blank', 'noopener,noreferrer')}
                                    >
                                        <ExternalLink className="size-4" />
                                        {t('tvShow.openInTmdb', { ns: 'components', defaultValue: 'Open in TMDB' })}
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
