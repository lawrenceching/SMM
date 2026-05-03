import type { UIMediaMetadata } from "@/types/UIMediaMetadata"
import type { UIMediaFolder } from "@/types/UIMediaFolder"
import { FileEdit, Download, Scan, MoreVertical, ExternalLink, List, LayoutGrid, PanelTop, Captions } from "lucide-react"
import { MediaDatabaseSearchbox } from "./MediaDatabaseSearchbox"
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
    onSearchResultSelected: (args: import("./MediaDatabaseSearchbox").SearchResultSelectedArgs) => void
    onRecognizeButtonClick?: () => void
    onRenameClick?: () => void
    /** Opens transcribe dialog when VideoCaptioner is available and there are video files. */
    onTranscribeClick?: () => void
    isTranscribeAvailable?: boolean
    /** True when `mediaFiles` has at least one entry (caller-derived). */
    hasTranscribeTargets?: boolean
    selectedMediaMetadata?: UIMediaMetadata
    selectedMediaFolder?: UIMediaFolder
    openScrape?: (params: { mediaMetadata: UIMediaMetadata }) => void
    episodeTableLayout?: EpisodeTableLayout
    onEpisodeTableLayoutChange?: (layout: EpisodeTableLayout) => void
}

export function TvShowHeaderV2({
    onSearchResultSelected,
    onRecognizeButtonClick,
    onRenameClick,
    onTranscribeClick,
    isTranscribeAvailable = false,
    hasTranscribeTargets = false,
    selectedMediaMetadata,
    selectedMediaFolder,
    openScrape,
    episodeTableLayout = "simple",
    onEpisodeTableLayoutChange,
}: TvShowHeaderV2Props) {
    const { t } = useTranslation(['components', 'errors', 'dialogs'])

    const tvShow = selectedMediaMetadata?.tvShow;
    const tvdbTvShowName = tvShow?.name ?? ''
    const movie = selectedMediaMetadata?.movie
    const folderStatus = selectedMediaFolder?.status
    const isUpdatingTvShow = selectedMediaFolder === undefined
       || folderStatus === 'idle'
       || folderStatus === 'pending_for_initialization'
       || folderStatus === 'initializing'
       || folderStatus === 'loading'
       || folderStatus === 'updating'
    const isMediaMetadataOk = folderStatus === 'ok'
    const initialSearchValue = tvShow?.name ?? tvdbTvShowName

    const hasValidTmdbTvShow = (tvShow != null && tvShow.id != null) || (selectedMediaMetadata?.tvShow != null)
    const actionsDisabled = !hasValidTmdbTvShow
    const unrecognizedHint =
        isMediaMetadataOk && actionsDisabled
            ? (t('tvShow.unrecognizedFolderHint' as any, { ns: 'components' }) as string)
            : undefined

    const database = tvShow?.database ?? movie?.database
    const mediaId = tvShow?.id ?? movie?.id
    const mediaName = tvShow?.name ?? movie?.name ?? ''
    const transcribeBlocked =
        actionsDisabled ||
        !hasTranscribeTargets ||
        !isTranscribeAvailable

    const hasExternalId = !!mediaId
    const externalUrl = hasExternalId
        ? database === 'TVDB'
            ? `https://www.thetvdb.com/search?query=${encodeURIComponent(`${mediaId} ${mediaName}`)}`
            : tvShow?.id != null
                ? `https://www.themoviedb.org/tv/${mediaId}`
                : `https://www.themoviedb.org/movie/${mediaId}`
        : undefined

    return (
        <div className="relative w-full space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="flex-1 min-w-0" style={{ minWidth: '25%', maxWidth: '50%' }}>
                    {isUpdatingTvShow ? (
                        <Skeleton className="h-9 w-full max-w-md" />
                    ) : (
                        <MediaDatabaseSearchbox
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
                                data-testid="recognize-button"
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
                                data-testid="rename-button"
                            >
                                <FileEdit className="size-4 mr-2" />
                                {t('tvShow.rename', { ns: 'components' })}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="hidden @[220px]:inline-flex"
                                data-testid="scrape-button"
                                onClick={() => {
                                    if (!selectedMediaMetadata?.mediaFiles || !selectedMediaMetadata.tvShow) return

                                    openScrape?.({
                                        mediaMetadata: selectedMediaMetadata
                                    })
                                }}
                                disabled={actionsDisabled || !selectedMediaMetadata?.mediaFiles || selectedMediaMetadata.mediaFiles.length === 0}
                            >
                                <Download className="size-4 mr-2" />
                                {t('tvShow.scrape', { ns: 'components' })}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="hidden @[200px]:inline-flex"
                                data-testid="tvshow-header-transcribe"
                                disabled={transcribeBlocked}
                                onClick={() => onTranscribeClick?.()}
                            >
                                <Captions className="size-4 mr-2" />
                                {t('mediaPlayer.trackContextMenu.transcribe', { ns: 'components' })}
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
                                            if (!selectedMediaMetadata?.mediaFiles || !selectedMediaMetadata.tvShow) return
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
                                        disabled={!externalUrl}
                                        onClick={() => externalUrl && window.open(externalUrl, '_blank', 'noopener,noreferrer')}
                                    >
                                        <ExternalLink className="size-4" />
                                        {database === 'TVDB'
                                            ? t('tvShow.openInTvdb', { ns: 'components', defaultValue: 'Open in TVDB' })
                                            : t('tvShow.openInTmdb', { ns: 'components', defaultValue: 'Open in TMDB' })}
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
