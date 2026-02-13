import { useCallback } from "react"
import type { MediaMetadata } from "@core/types"
import { Nfo } from "@/lib/nfo"
import { writeFile } from "@/api/writeFile"
import { getTMDBImageUrl } from "@/api/tmdb"
import { join } from "@/lib/path"
import { Path } from "@core/path"
import { toast } from "sonner"
import { isError, ExistedFileError } from "@core/errors"
import { useTranslation } from "@/lib/i18n"

async function startToGenerateTvShowNfo(mediaMetadata: MediaMetadata, getTranslation: () => string) {
    // Generate NFO file from media metadata
    if (!mediaMetadata?.tmdbTvShow || !mediaMetadata?.mediaFolderPath) {
        console.error("Cannot generate NFO: Missing TV show data or media folder path")
        return
    }

    try {
        const tvShow = mediaMetadata.tmdbTvShow
        const nfo = new Nfo()

        // Populate NFO with TV show data
        nfo.id = tvShow.id?.toString()
        nfo.title = tvShow.name
        nfo.originalTitle = tvShow.original_name
        nfo.showTitle = tvShow.name
        nfo.plot = tvShow.overview
        nfo.tmdbid = tvShow.id?.toString()

        // Add fanart (backdrop)
        if (tvShow.backdrop_path) {
            const fanartUrl = getTMDBImageUrl(tvShow.backdrop_path, "original")
            if (fanartUrl) {
                nfo.fanart = fanartUrl
            }
        }

        // Add thumbs (poster and season posters)
        const thumbs: Array<{ url: string; aspect: "poster" | "clearlogo" | null; season?: number; type?: string }> = []
        
        // Add main poster
        if (tvShow.poster_path) {
            const posterUrl = getTMDBImageUrl(tvShow.poster_path, "original")
            if (posterUrl) {
                thumbs.push({ url: posterUrl, aspect: "poster" })
            }
        }

        // Add season posters
        if (tvShow.seasons) {
            tvShow.seasons.forEach(season => {
                if (season.poster_path) {
                    const seasonPosterUrl = getTMDBImageUrl(season.poster_path, "original")
                    if (seasonPosterUrl) {
                        thumbs.push({ 
                            url: seasonPosterUrl, 
                            aspect: "poster", 
                            season: season.season_number,
                            type: "season"
                        })
                    }
                }
            })
        }

        nfo.thumbs = thumbs

        // Generate XML
        const xml = nfo.toXML()

        // Write NFO file to media folder
        const nfoPath = join(mediaMetadata.mediaFolderPath, "tvshow.nfo")
        await writeFile(Path.toPlatformPath(nfoPath), xml)
        console.log(`✅ NFO file written to: ${nfoPath}`)
    } catch (error) {
        console.error("Failed to generate NFO file:", error)
        const errorMessage = error instanceof Error ? error.message : "Failed to generate NFO file"
        
        // Check if error is "File Already Existed"
        if (isError(errorMessage, ExistedFileError)) {
            toast.error(getTranslation(), {
                description: errorMessage
            })
        } else {
            toast.error("Failed to write NFO file", {
                description: errorMessage
            })
        }
        
        throw error // Re-throw to let the task handler mark it as failed
    }
}

export function useHandleScrapeStart() {
    const { t } = useTranslation('dialogs')
    const handleScrapeStart = useCallback(async (mediaMetadata: MediaMetadata) => {
        const fileAlreadyExistsMessage = t('errors.fileAlreadyExists' as any)
        try {
            await startToGenerateTvShowNfo(mediaMetadata, () => fileAlreadyExistsMessage)
            
            // Call done callback to mark all tasks as completed

            // temporarily disable below function to avoid scraping issues

            // if (!mediaFolderPath) {
            //     console.error("No media folder path available")
            //     return
            // }

            // // Update all tasks to running
            // updateTasks(initialTasks.map(task => ({
            //     ...task,
            //     status: "running" as const
            // })))

            // try {
            //     // Call the scrape API
            //     const response = await scrapeApi(mediaFolderPath)
            
            //     if (response.error) {
            //         // All tasks failed
            //         updateTasks(initialTasks.map(task => ({
            //             ...task,
            //             status: "failed" as const
            //         })))
            //         console.error("Scrape failed:", response.error)
            //     } else {
            //         // All tasks completed successfully
            //         updateTasks(initialTasks.map(task => ({
            //             ...task,
            //             status: "completed" as const
            //         })))
            //         console.log("Scrape completed successfully")
                
            //         // Refresh media metadata after successful scrape
            //         refreshMediaMetadata(mediaFolderPath)
            //     }
            // } catch (error) {
            //     // All tasks failed
            //     updateTasks(initialTasks.map(task => ({
            //         ...task,
            //         status: "failed" as const
            //     })))
            //     console.error("Scrape error:", error)
            // }
        } catch (error) {
            console.error("Scrape start error:", error)
            throw error // Re-throw so the task handler can mark the task as failed
        }
    }, [t])

    return handleScrapeStart
}
