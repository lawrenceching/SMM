import type { TMDBTVShow, TMDBMovie } from "@core/types"
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"
import { FileEdit, Download, Scan } from "lucide-react"
import { TMDBSearchbox } from "./TMDBSearchbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "./ui/button"
import { useTranslation } from "@/lib/i18n"

export interface TvShowHeaderV2Props {
    onSearchResultSelected: (result: TMDBTVShow | TMDBMovie) => void
    onRecognizeButtonClick?: () => void
    onRenameClick?: () => void
    selectedMediaMetadata?: UIMediaMetadata
    openScrape?: (params: { mediaMetadata: UIMediaMetadata }) => void
}

export function TvShowHeaderV2({
    onSearchResultSelected,
    onRecognizeButtonClick,
    onRenameClick,
    selectedMediaMetadata,
    openScrape,
}: TvShowHeaderV2Props) {
    const { t } = useTranslation(['components', 'errors', 'dialogs'])

    const tvShow = selectedMediaMetadata?.tmdbTvShow
    const isUpdatingTvShow = selectedMediaMetadata?.status === 'updating'
    const initialSearchValue = tvShow?.name

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
                <div className="flex gap-2 flex-wrap shrink-0">
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
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
