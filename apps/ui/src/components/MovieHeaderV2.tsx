import type { TMDBTVShow, TMDBMovie } from "@core/types"
import type { TmdbSearchLanguage } from "./TMDBSearchbox"
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"
import { FileEdit, Download, MoreVertical, ExternalLink } from "lucide-react"
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

export interface MovieHeaderV2Props {
    onSearchResultSelected: (result: TMDBTVShow | TMDBMovie, searchLanguage: TmdbSearchLanguage) => void
    onRenameClick?: () => void
    selectedMediaMetadata?: UIMediaMetadata
    openScrape?: (params: { mediaMetadata: UIMediaMetadata }) => void
}

export function MovieHeaderV2({
    onSearchResultSelected,
    onRenameClick,
    selectedMediaMetadata,
    openScrape,
}: MovieHeaderV2Props) {
    const { t } = useTranslation(['components', 'errors', 'dialogs'])

    const movie = selectedMediaMetadata?.tmdbMovie
    const isUpdatingMovie = selectedMediaMetadata?.status === 'updating'
    const initialSearchValue = movie?.title

    const hasValidTmdbMovie = movie != null && movie.id != null
    const actionsDisabled = !hasValidTmdbMovie
    const unrecognizedHint = actionsDisabled ? (t('movie.unrecognizedFolderHint' as any, { ns: 'components' }) as string) : undefined

    const tmdbId = movie?.id
    const hasTmdbId = tmdbId != null
    const tmdbUrl = hasTmdbId ? `https://www.themoviedb.org/movie/${tmdbId}` : undefined

    return (
        <div className="relative w-full space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="flex-1 min-w-0">
                    {isUpdatingMovie ? (
                        <Skeleton className="h-9 w-full max-w-md" />
                    ) : (
                        <TMDBSearchbox
                            mediaType="movie"
                            value={initialSearchValue}
                            onSearchResultSelected={onSearchResultSelected}
                            placeholder={t('movie.searchPlaceholder', { ns: 'components' })}
                            inputClassName="text-lg font-semibold"
                            unrecognizedHint={unrecognizedHint}
                        />
                    )}
                </div>
                <div className="flex gap-2 flex-wrap shrink-0">
                    {isUpdatingMovie ? (
                        <>
                            <Skeleton className="h-9 w-24" />
                            <Skeleton className="h-9 w-24" />
                        </>
                    ) : (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={actionsDisabled}
                                onClick={() => {
                                    onRenameClick?.()
                                }}
                            >
                                <FileEdit className="size-4 mr-2" />
                                {t('movie.rename', { ns: 'components' })}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    if (!selectedMediaMetadata?.mediaFiles || !selectedMediaMetadata.tmdbMovie) return

                                    openScrape?.({
                                        mediaMetadata: selectedMediaMetadata
                                    })
                                }}
                                disabled={actionsDisabled || !selectedMediaMetadata?.mediaFiles || selectedMediaMetadata.mediaFiles.length === 0}
                            >
                                <Download className="size-4 mr-2" />
                                {t('movie.scrape', { ns: 'components' })}
                            </Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="size-9 shrink-0"
                                        disabled={!hasTmdbId}
                                        aria-label={t('movie.more', { ns: 'components', defaultValue: 'More' })}
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
                                        {t('movie.openInTmdb', { ns: 'components', defaultValue: 'Open in TMDB' })}
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
