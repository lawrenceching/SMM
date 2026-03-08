import { useCallback } from "react"
import type { MediaMetadata } from "@core/types"
import { getTMDBImageUrl } from "@/api/tmdb"
import { downloadImageApi } from "@/api/downloadImage"
import { join } from "@/lib/path"
import { toast } from "sonner"
import { isError, ExistedFileError } from "@core/errors"
import { useTranslation } from "@/lib/i18n"
import { checkFileExists } from "@/lib/utils"

async function startToDownloadFanart(mediaMetadata: MediaMetadata, getTranslation: () => string) {
    const isTvShow = !!mediaMetadata?.tmdbTvShow
    const isMovie = !!mediaMetadata?.tmdbMovie
    if ((!isTvShow && !isMovie) || !mediaMetadata?.mediaFolderPath) {
        console.error("Cannot download fanart: Missing TV show/movie data or media folder path")
        return
    }

    try {
        const backdropPathSource = mediaMetadata.tmdbTvShow?.backdrop_path ?? mediaMetadata.tmdbMovie?.backdrop_path
        const entityId = mediaMetadata.tmdbTvShow?.id ?? mediaMetadata.tmdbMovie?.id
        const entityName = mediaMetadata.tmdbTvShow?.name ?? mediaMetadata.tmdbMovie?.title

        if (!backdropPathSource) {
            console.log(`⏭️ No fanart found: id=${entityId}, name=${entityName}`)
            return
        }

        // Get the full fanart URL
        const fanartUrl = getTMDBImageUrl(backdropPathSource, "original")
        if (!fanartUrl) {
            console.error("Failed to get fanart URL from TMDB")
            throw new Error("Failed to get fanart URL from TMDB")
        }

        // Extract file extension from URL (similar to scrape.ts)
        const urlParts = fanartUrl.split('.')
        const extension = urlParts[urlParts.length - 1] || 'jpg'

        // Build destination path
        const fanartPath = join(mediaMetadata.mediaFolderPath, `fanart.${extension}`)

        // Check if file already exists
        console.log(`[startToDownloadFanart] Checking if fanart exists: ${fanartPath}`)
        const fileExists = await checkFileExists(fanartPath)
        if (fileExists) {
            console.log(`[startToDownloadFanart] Fanart already exists, skipping download: ${fanartPath}`)
            return
        }

        // Download the image
        console.log(`[startToDownloadFanart] Downloading fanart to ${fanartPath}`)
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
