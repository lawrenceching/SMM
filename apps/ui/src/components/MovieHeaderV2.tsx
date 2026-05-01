import type { UIMediaMetadata } from "@/types/UIMediaMetadata"
import type { UIMediaFolder } from "@/types/UIMediaFolder"
import { FileEdit, Download, MoreVertical, ExternalLink } from "lucide-react"
import { MediaDatabaseSearchbox } from "./MediaDatabaseSearchbox"
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
    onSearchResultSelected: (args: import("./MediaDatabaseSearchbox").SearchResultSelectedArgs) => void
    onRenameClick?: () => void
    selectedMediaMetadata?: UIMediaMetadata
    selectedMediaFolder?: UIMediaFolder
    openScrape?: (params: { mediaMetadata: UIMediaMetadata }) => void
}

export function MovieHeaderV2({
    onSearchResultSelected,
    onRenameClick,
    selectedMediaMetadata,
    selectedMediaFolder,
    openScrape,
}: MovieHeaderV2Props) {
    const { t } = useTranslation(['components', 'errors', 'dialogs'])

    const folderStatus = selectedMediaFolder?.status
    const movieMeta = selectedMediaMetadata?.movie
    const isUpdatingMovie = selectedMediaFolder === undefined
       || folderStatus === 'idle'
       || folderStatus === 'pending_for_initialization'
       || folderStatus === 'initializing'
       || folderStatus === 'loading'
       || folderStatus === 'updating'
    const isMediaMetadataOk = folderStatus === 'ok'
    const initialSearchValue = movieMeta?.name ?? ''

    const hasValidMovieMetadata = movieMeta != null
    const actionsDisabled = !hasValidMovieMetadata
    const unrecognizedHint =
        isMediaMetadataOk && actionsDisabled
            ? (t('movie.unrecognizedFolderHint' as any, { ns: 'components' }) as string)
            : undefined

    const database = movieMeta?.database
    const mediaId = movieMeta?.id
    const mediaName = movieMeta?.name ?? ''
    const isTmdb = database === 'TMDB'
    const hasExternalId = !!mediaId
    const externalUrl = hasExternalId
        ? isTmdb
            ? `https://www.themoviedb.org/movie/${mediaId}`
            : `https://www.thetvdb.com/search?query=${encodeURIComponent(`${mediaId} ${mediaName}`)}`
        : undefined

    return (
        <div className="relative w-full space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="flex-1 min-w-0">
                    {isUpdatingMovie ? (
                        <Skeleton className="h-9 w-full max-w-md" />
                    ) : (
                        <MediaDatabaseSearchbox
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
                                    const scrapeBlocked =
                                        actionsDisabled ||
                                        !selectedMediaMetadata?.mediaFiles ||
                                        selectedMediaMetadata.mediaFiles.length === 0
                                    if (scrapeBlocked) {
                                        return
                                    }

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
                                        disabled={!hasExternalId}
                                        aria-label={t('movie.more', { ns: 'components', defaultValue: 'More' })}
                                    >
                                        <MoreVertical className="size-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                        disabled={!externalUrl}
                                        onClick={() => externalUrl && window.open(externalUrl, '_blank', 'noopener,noreferrer')}
                                    >
                                        <ExternalLink className="size-4" />
                                        {database === 'TVDB'
                                            ? t('movie.openInTvdb', { ns: 'components', defaultValue: 'Open in TVDB' })
                                            : t('movie.openInTmdb', { ns: 'components', defaultValue: 'Open in TMDB' })}
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
