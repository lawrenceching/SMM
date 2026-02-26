import type { TMDBTVShow, TMDBMovie } from "@core/types"
import { cn } from "@/lib/utils"
import { forwardRef } from "react"
import { SeasonSection } from "./season-section"
import type { SeasonModel } from "./TvShowPanel"
import { TVShowHeader } from "./tv-show-header"

export interface TMDBTVShowOverviewRef {
    handleSelectResult: (result: TMDBTVShow) => Promise<void>
}

interface TMDBTVShowOverviewProps {
    className?: string
    onRenameClick?: () => void
    onRecognizeButtonClick?: () => void
    seasons: SeasonModel[]
    scrollToEpisodeId?: number | null
    onEpisodeFileSelect?: (episode: import("@core/types").TMDBEpisode) => void
    onSearchResultSelected: (result: TMDBTVShow | TMDBMovie) => void
    selectedMediaMetadata?: import("@/types/UIMediaMetadata").UIMediaMetadata
    openScrape?: (params: { mediaMetadata: import("@/types/UIMediaMetadata").UIMediaMetadata }) => void
}

function getTMDBImageUrl(path: string | null, size: "w200" | "w300" | "w500" | "w780" | "original" = "w500"): string | null {
    if (!path) return null
    const baseUrl = "https://image.tmdb.org/t/p"
    return `${baseUrl}/${size}${path}`
}

/**
 * @deprecated
 */
export const TMDBTVShowOverview = forwardRef<TMDBTVShowOverviewRef, TMDBTVShowOverviewProps>(
    ({ className, onRenameClick, onRecognizeButtonClick,
        seasons, scrollToEpisodeId, onEpisodeFileSelect,
        onSearchResultSelected,
        selectedMediaMetadata, openScrape }) => {
    const backdropUrl = selectedMediaMetadata?.tmdbTvShow ? getTMDBImageUrl(selectedMediaMetadata.tmdbTvShow.backdrop_path, "w780") : null
    const isUpdatingTvShow = selectedMediaMetadata?.status === 'updating' || selectedMediaMetadata?.status === 'initializing'

    if (!selectedMediaMetadata?.tmdbTvShow && !isUpdatingTvShow) {
        return (
            <div className={cn("relative w-full h-full flex flex-col", className)}>
                <div className="relative p-6 flex-1 overflow-y-auto">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <TVShowHeader
                                onSearchResultSelected={onSearchResultSelected}
                                selectedMediaMetadata={selectedMediaMetadata}
                                openScrape={openScrape}
                            />
                        </div>
                    </div>
                </div>
            </div>
        )
    }
    
    return (
        <div className={cn("relative w-full h-full overflow-hidden rounded-lg flex flex-col", className)}>
            {backdropUrl && (
                <div 
                    className="absolute inset-0 bg-cover bg-center opacity-20 dark:opacity-10"
                    style={{ backgroundImage: `url(${backdropUrl})` }}
                />
            )}
            <div className="relative p-6 flex-1 overflow-y-auto space-y-6">
                <TVShowHeader
                    onSearchResultSelected={onSearchResultSelected}
                    onRecognizeButtonClick={onRecognizeButtonClick}
                    onRenameClick={onRenameClick}
                    selectedMediaMetadata={selectedMediaMetadata}
                    openScrape={openScrape}
                />

                <SeasonSection
                    selectedMediaMetadata={selectedMediaMetadata}
                    seasons={seasons}
                    scrollToEpisodeId={scrollToEpisodeId}
                    onEpisodeFileSelect={onEpisodeFileSelect}
                />
            </div>
        </div>
    )
})

TMDBTVShowOverview.displayName = 'TMDBTVShowOverview'
