import { useCallback } from "react"
import type { MediaMetadata } from "@core/types"
import { useTranslation } from "@/lib/i18n"
import { getMovieById } from "@/api/tmdb"
import { getTVDBv4Client } from "@/lib/TvdbUtils"
import { useDownloadThumbnailFromTMDB } from "./useDownloadThumbnailFromTMDB"
import { useDownloadThumbnailFromTVDB } from "./useDownloadThumbnailFromTVDB"

export function useHandleThumbnailDownload() {
    const { t } = useTranslation('dialogs')
    const downloadThumbnailFromTMDBMutation = useDownloadThumbnailFromTMDB()
    const downloadThumbnailFromTVDBMutation = useDownloadThumbnailFromTVDB()

    const handleThumbnailDownload = useCallback(async (mediaMetadata: MediaMetadata) => {

        if(mediaMetadata.type === 'tvshow-folder') {

            const tvShow = mediaMetadata.tvShow;
            if(tvShow === undefined) {
                console.error("Thumbnail download skipped: TV show is undefined")
                return;
            }

            if(tvShow.database === 'TMDB') {
                const tvShowId = parseInt(tvShow.id);
                await downloadThumbnailFromTMDBMutation.mutateAsync({
                    seriesId: tvShowId,
                    mediaFiles: mediaMetadata.mediaFiles ?? [],
                })

            } else if(tvShow.database === 'TVDB') {
                const tvShowId = parseInt(tvShow.id);
                await downloadThumbnailFromTVDBMutation.mutateAsync({
                    seriesId: tvShowId,
                    mediaFiles: mediaMetadata.mediaFiles ?? [],
                })
            } else {
                console.warn("Thumbnail download skipped: unsupported database " + tvShow.database)
                return;
            }

            

        } else if(mediaMetadata.type === 'movie-folder') {

            const movie = mediaMetadata.movie;
            if(movie === undefined) {
                console.error("Thumbnail download skipped: Movie is undefined")
                return;
            }

            if(movie.database === 'TMDB') {
                const movieId = parseInt(movie.id);
                const tmdbMovie = await getMovieById(movieId, 'en-US');
                // TODO:
            } else if(movie.database === 'TVDB') {
                const movieId = parseInt(movie.id);
                const tvdb = getTVDBv4Client();
                const tvdbMovie = await tvdb.movieExtendedById(movieId);
                // TODO:
            } else {
                console.warn("Thumbnail download skipped: unsupported database " + movie.database)
                return;
            }

        } else {
            console.warn("Thumbnail download skipped: unsupported folder type " + mediaMetadata.type)
            return;
        }

        const fileAlreadyExistsMessage = t('errors.fileAlreadyExists' as any)
        try {
            // await startToDownloadThumbnails(mediaMetadata, () => fileAlreadyExistsMessage)
        } catch (error) {
            console.error("Thumbnail download error:", error)
            throw error // Re-throw so the task handler can mark the task as failed
        }
    }, [t])

    return handleThumbnailDownload
}


