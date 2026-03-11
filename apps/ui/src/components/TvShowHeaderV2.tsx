import type { TMDBTVShow, TMDBMovie } from "@core/types"
import type { TmdbSearchLanguage } from "./TMDBSearchbox"
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"
import { FileEdit, Download, Scan, MoreVertical, ExternalLink, List, LayoutGrid, PanelTop } from "lucide-react"
import { TMDBSearchbox } from "./TMDBSearchbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "./ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export type EpisodeTableLayout = "simple" | "detail" | "preview"

export interface TvShowHeaderV2Props {
    onSearchResultSelected: (result: TMDBTVShow | TMDBMovie, searchLanguage: TmdbSearchLanguage) => void
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

    const hasValidTmdbTvShow = tvShow != null && tvShow.id != null
    const actionsDisabled = !hasValidTmdbTvShow
    const unrecognizedHint = actionsDisabled ? (t('tvShow.unrecognizedFolderHint' as any, { ns: 'components' }) as string) : undefined

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
                <div className="flex-1 min-w-0" style={{ minWidth: '25%', maxWidth: '50%' }}>
                    {isUpdatingTvShow ? (
                        <Skeleton className="h-9 w-full max-w-md" />
                    ) : (
                        <TMDBSearchbox
                            mediaType="tv"
                            value={initialSearchValue}
                            onSearchResultSelected={onSearchResultSelected}
                            placeholder={t('tvShow.searchPlaceholder', { ns: 'components' })}
                            inputClassName="text-lg font-semibold"
                            unrecognizedHint={unrecognizedHint}
                        />
                    )}
                </div>
                <div className="@container flex flex-1 min-w-0 flex-nowrap justify-end gap-2 items-center">
                    {onEpisodeTableLayoutChange && (
                        <div className="hidden @[520px]:inline-flex items-center rounded-md border border-input bg-background shadow-xs">
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
                                    "h-9 w-9 rounded-none transition-all",
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
                            <div className="h-4 w-px bg-border" />
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onEpisodeTableLayoutChange("preview")}
                                disabled={isUpdatingTvShow}
                                className={cn(
                                    "h-9 w-9 rounded-none rounded-r-md transition-all",
                                    episodeTableLayout === "preview"
                                        ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20"
                                        : "hover:bg-accent hover:text-accent-foreground"
                                )}
                                title={t('tvShow.layoutPreview', { ns: 'components', defaultValue: 'Preview layout' })}
                                aria-label={t('tvShow.layoutPreview', { ns: 'components', defaultValue: 'Preview layout' })}
                                aria-pressed={episodeTableLayout === "preview"}
                            >
                                <PanelTop className="size-4" />
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
                                className="hidden @[410px]:inline-flex"
                                disabled={actionsDisabled}
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
                                className="hidden @[310px]:inline-flex"
                                disabled={actionsDisabled}
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
                                className="hidden @[220px]:inline-flex"
                                onClick={() => {
                                    if (!selectedMediaMetadata?.mediaFiles || !selectedMediaMetadata.tmdbTvShow) return

                                    openScrape?.({
                                        mediaMetadata: selectedMediaMetadata
                                    })
                                }}
                                disabled={actionsDisabled || !selectedMediaMetadata?.mediaFiles || selectedMediaMetadata.mediaFiles.length === 0}
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
                                        aria-label={t('tvShow.more', { ns: 'components', defaultValue: 'More' })}
                                    >
                                        <MoreVertical className="size-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {onEpisodeTableLayoutChange && (
                                        <>
                                            <DropdownMenuItem
                                                className="@[520px]:hidden"
                                                disabled={isUpdatingTvShow}
                                                onClick={() => onEpisodeTableLayoutChange("simple")}
                                            >
                                                <List className="size-4" />
                                                {t('tvShow.layoutSimple', { ns: 'components', defaultValue: 'Simple layout' })}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="@[520px]:hidden"
                                                disabled={isUpdatingTvShow}
                                                onClick={() => onEpisodeTableLayoutChange("detail")}
                                            >
                                                <LayoutGrid className="size-4" />
                                                {t('tvShow.layoutDetail', { ns: 'components', defaultValue: 'Detail layout' })}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="@[520px]:hidden"
                                                disabled={isUpdatingTvShow}
                                                onClick={() => onEpisodeTableLayoutChange("preview")}
                                            >
                                                <PanelTop className="size-4" />
                                                {t('tvShow.layoutPreview', { ns: 'components', defaultValue: 'Preview layout' })}
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                    <DropdownMenuItem
                                        className="@[410px]:hidden"
                                        disabled={actionsDisabled}
                                        onClick={() => onRecognizeButtonClick?.()}
                                    >
                                        <Scan className="size-4" />
                                        {t('tvShow.recognize', { ns: 'components', defaultValue: 'Recognize' })}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="@[310px]:hidden"
                                        disabled={actionsDisabled}
                                        onClick={() => onRenameClick?.()}
                                    >
                                        <FileEdit className="size-4" />
                                        {t('tvShow.rename', { ns: 'components' })}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="@[220px]:hidden"
                                        disabled={actionsDisabled || !selectedMediaMetadata?.mediaFiles || selectedMediaMetadata.mediaFiles.length === 0}
                                        onClick={() => {
                                            if (!selectedMediaMetadata?.mediaFiles || !selectedMediaMetadata.tmdbTvShow) return
                                            openScrape?.({
                                                mediaMetadata: selectedMediaMetadata
                                            })
                                        }}
                                    >
                                        <Download className="size-4" />
                                        {t('tvShow.scrape', { ns: 'components' })}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator className="@[520px]:hidden" />
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
