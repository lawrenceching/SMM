import { useCallback } from "react"
import type { MediaMetadata } from "@core/types"
import { Nfo } from "@/lib/nfo"
import { writeFile } from "@/api/writeFile"
import { getTMDBImageUrl } from "@/api/tmdb"
import { join } from "@/lib/path"
import { Path } from "@core/path"

async function startToGenerateTvShowNfo(mediaMetadata: MediaMetadata) {
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
    }
}

export function useHandleScrapeStart() {
    const handleScrapeStart = useCallback(async (mediaMetadata: MediaMetadata) => {
        try {
            await startToGenerateTvShowNfo(mediaMetadata)
            
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
            // On error, still call done to mark tasks as completed (or could mark as failed)
            done()
        }
    }, [])

    return handleScrapeStart
}
