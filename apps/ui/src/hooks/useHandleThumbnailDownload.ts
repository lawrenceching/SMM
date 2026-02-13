import { useCallback } from "react"
import type { MediaMetadata } from "@core/types"
import { downloadThumbnail, downloadSeasonPoster } from "@/lib/utils"
import { toast } from "sonner"
import { isError, ExistedFileError } from "@core/errors"
import { useTranslation } from "@/lib/i18n"

async function startToDownloadThumbnails(mediaMetadata: MediaMetadata, getTranslation: () => string) {
    // Download thumbnails for all episode media files
    if (!mediaMetadata?.tmdbTvShow || !mediaMetadata?.mediaFolderPath) {
        console.error("Cannot download thumbnails: Missing TV show data or media folder path")
        throw new Error("Cannot download thumbnails: Missing TV show data or media folder path")
    }

    // Check if mediaFiles exists and is not empty
    if (!mediaMetadata.mediaFiles || mediaMetadata.mediaFiles.length === 0) {
        console.log("⏭️ No media files found for thumbnail download")
        return
    }

    try {
        let processedCount = 0
        let skippedCount = 0

        // Iterate through each media file and download thumbnails
        for (const mediaFile of mediaMetadata.mediaFiles) {
            // Skip files without season/episode numbers
            if (mediaFile.seasonNumber === undefined || mediaFile.episodeNumber === undefined) {
                console.log(`⏭️ Skipping thumbnail download for ${mediaFile.absolutePath}: missing season/episode numbers`)
                skippedCount++
                continue
            }

            // downloadThumbnail handles errors internally (logs and returns early)
            // It doesn't throw, so we just await it
            await downloadThumbnail(mediaMetadata, mediaFile)
            processedCount++
        }

        console.log(`✅ Episode thumbnail download completed: ${processedCount} processed, ${skippedCount} skipped`)

        // Download season posters after episode thumbnails
        let seasonPosterCount = 0
        let seasonPosterSkippedCount = 0

        if (mediaMetadata.tmdbTvShow?.seasons) {
            for (const season of mediaMetadata.tmdbTvShow.seasons) {
                // downloadSeasonPoster handles errors internally (logs and returns early)
                // It doesn't throw, so we just await it
                if (season.poster_path) {
                    await downloadSeasonPoster(mediaMetadata, season)
                    seasonPosterCount++
                } else {
                    seasonPosterSkippedCount++
                }
            }
        }

        console.log(`✅ Season poster download completed: ${seasonPosterCount} processed, ${seasonPosterSkippedCount} skipped`)
        console.log(`✅ Total thumbnail download completed: ${processedCount} episode thumbnails, ${seasonPosterCount} season posters`)
    } catch (error) {
        console.error("Failed to download thumbnails:", error)
        const errorMessage = error instanceof Error ? error.message : "Failed to download thumbnails"
        
        // Check if error is "File Already Existed"
        if (isError(errorMessage, ExistedFileError)) {
            toast.error(getTranslation(), {
                description: errorMessage
            })
        } else {
            toast.error("Failed to download thumbnails", {
                description: errorMessage
            })
        }
        
        throw error // Re-throw to let the task handler mark it as failed
    }
}

export function useHandleThumbnailDownload() {
    const { t } = useTranslation('dialogs')
    const handleThumbnailDownload = useCallback(async (mediaMetadata: MediaMetadata) => {
        const fileAlreadyExistsMessage = t('errors.fileAlreadyExists' as any)
        try {
            await startToDownloadThumbnails(mediaMetadata, () => fileAlreadyExistsMessage)
        } catch (error) {
            console.error("Thumbnail download error:", error)
            throw error // Re-throw so the task handler can mark the task as failed
        }
    }, [t])

    return handleThumbnailDownload
}
