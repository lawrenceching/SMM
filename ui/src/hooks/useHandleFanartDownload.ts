import { useCallback } from "react"
import type { MediaMetadata } from "@core/types"
import { getTMDBImageUrl } from "@/api/tmdb"
import { downloadImageApi } from "@/api/downloadImage"
import { join } from "@/lib/path"
import { toast } from "sonner"
import { isError, ExistedFileError } from "@core/errors"
import { useTranslation } from "@/lib/i18n"

async function startToDownloadFanart(mediaMetadata: MediaMetadata, getTranslation: () => string) {
    // Download fanart image from media metadata
    if (!mediaMetadata?.tmdbTvShow || !mediaMetadata?.mediaFolderPath) {
        console.error("Cannot download fanart: Missing TV show data or media folder path")
        return
    }

    try {
        const tvShow = mediaMetadata.tmdbTvShow
        
        // Check if backdrop path exists
        if (!tvShow.backdrop_path) {
            console.log(`⏭️ No fanart found for TV Show: tmdbTvShowId=${tvShow.id}, name=${tvShow.name}`)
            return
        }

        // Get the full fanart URL
        const fanartUrl = getTMDBImageUrl(tvShow.backdrop_path, "original")
        if (!fanartUrl) {
            console.error("Failed to get fanart URL from TMDB")
            throw new Error("Failed to get fanart URL from TMDB")
        }

        // Extract file extension from URL (similar to scrape.ts)
        const urlParts = fanartUrl.split('.')
        const extension = urlParts[urlParts.length - 1] || 'jpg'

        // Build destination path
        const fanartPath = join(mediaMetadata.mediaFolderPath, `fanart.${extension}`)

        // Download the image
        const response = await downloadImageApi(fanartUrl, fanartPath)

        // Check for errors in response
        if (response.error) {
            throw new Error(response.error)
        }

        console.log(`✅ Fanart downloaded to: ${fanartPath}`)
    } catch (error) {
        console.error("Failed to download fanart:", error)
        const errorMessage = error instanceof Error ? error.message : "Failed to download fanart"
        
        // Check if error is "File Already Existed"
        if (isError(errorMessage, ExistedFileError)) {
            toast.error(getTranslation(), {
                description: errorMessage
            })
        } else {
            toast.error("Failed to download fanart", {
                description: errorMessage
            })
        }
        
        throw error // Re-throw to let the task handler mark it as failed
    }
}

export function useHandleFanartDownload() {
    const { t } = useTranslation('dialogs')
    const handleFanartDownload = useCallback(async (mediaMetadata: MediaMetadata) => {
        const fileAlreadyExistsMessage = t('errors.fileAlreadyExists' as any)
        try {
            await startToDownloadFanart(mediaMetadata, () => fileAlreadyExistsMessage)
        } catch (error) {
            console.error("Fanart download error:", error)
            throw error // Re-throw so the task handler can mark the task as failed
        }
    }, [t])

    return handleFanartDownload
}
