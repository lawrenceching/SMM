import { useCallback } from "react"
import type { MediaMetadata } from "@core/types"
import { getTMDBImageUrl } from "@/api/tmdb"
import { downloadImageApi } from "@/api/downloadImage"
import { join } from "@/lib/path"
import { toast } from "sonner"
import { isError, ExistedFileError } from "@core/errors"
import { useTranslation } from "@/lib/i18n"

async function startToDownloadPoster(mediaMetadata: MediaMetadata, getTranslation: () => string) {
    // Download poster image from media metadata
    if (!mediaMetadata?.tmdbTvShow || !mediaMetadata?.mediaFolderPath) {
        console.error("Cannot download poster: Missing TV show data or media folder path")
        return
    }

    try {
        const tvShow = mediaMetadata.tmdbTvShow
        
        // Check if poster path exists
        if (!tvShow.poster_path) {
            console.log(`⏭️ No poster found for TV Show: tmdbTvShowId=${tvShow.id}, name=${tvShow.name}`)
            return
        }

        // Get the full poster URL
        const posterUrl = getTMDBImageUrl(tvShow.poster_path, "original")
        if (!posterUrl) {
            console.error("Failed to get poster URL from TMDB")
            throw new Error("Failed to get poster URL from TMDB")
        }

        // Extract file extension from URL (similar to scrape.ts)
        const urlParts = posterUrl.split('.')
        const extension = urlParts[urlParts.length - 1] || 'jpg'

        // Build destination path
        const posterPath = join(mediaMetadata.mediaFolderPath, `poster.${extension}`)

        // Download the image
        const response = await downloadImageApi(posterUrl, posterPath)

        // Check for errors in response
        if (response.error) {
            throw new Error(response.error)
        }

        console.log(`✅ Poster downloaded to: ${posterPath}`)
    } catch (error) {
        console.error("Failed to download poster:", error)
        const errorMessage = error instanceof Error ? error.message : "Failed to download poster"
        
        // Check if error is "File Already Existed"
        if (isError(errorMessage, ExistedFileError)) {
            toast.error(getTranslation(), {
                description: errorMessage
            })
        } else {
            toast.error("Failed to download poster", {
                description: errorMessage
            })
        }
        
        throw error // Re-throw to let the task handler mark it as failed
    }
}

export function useHandlePosterDownload() {
    const { t } = useTranslation('dialogs')
    const handlePosterDownload = useCallback(async (mediaMetadata: MediaMetadata) => {
        const fileAlreadyExistsMessage = t('errors.fileAlreadyExists' as any)
        try {
            await startToDownloadPoster(mediaMetadata, () => fileAlreadyExistsMessage)
        } catch (error) {
            console.error("Poster download error:", error)
            throw error // Re-throw so the task handler can mark the task as failed
        }
    }, [t])

    return handlePosterDownload
}
