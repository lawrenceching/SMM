import type { Hono } from "hono";
import { stat } from "node:fs/promises";
import { Path } from "@core/path";
import type { ScrapeRequestBody, ScrapeResponseBody } from "@core/types";
import scrape from "@/utils/scrape";
import { findMediaMetadata } from "@/utils/mediaMetadata";
import { logHttpReqIn, logHttpRespOut } from "../../lib/logger";
import { getMovie, getTvShow } from "@/route/Tmdb";

export async function handleScrapeRequest(app: Hono) {
    app.post('/api/scrape', async (c) => {
        const raw = await c.req.json() as ScrapeRequestBody;

        logHttpReqIn(c, raw);

        const { mediaFolderPath } = raw;

        // Validate request
        if (!mediaFolderPath) {
            const resp: ScrapeResponseBody = {
                error: 'Invalid Request: mediaFolderPath is required'
            };
            logHttpRespOut(c, resp, 200);
            return c.json(resp, 200);
        }

        const folderPathInPlatformFormat = Path.toPlatformPath(mediaFolderPath);

        // Check if folder exists
        try {
            const stats = await stat(folderPathInPlatformFormat);
            if (!stats.isDirectory()) {
                const resp: ScrapeResponseBody = {
                    error: `Folder Not Found: ${folderPathInPlatformFormat} is not a directory`
                };
                logHttpRespOut(c, resp, 200);
                return c.json(resp, 200);
            }
        } catch (error) {
            const resp: ScrapeResponseBody = {
                error: `unexpected error: ${error instanceof Error ? error.message : String(error)}`
            };
            logHttpRespOut(c, resp, 200);
            return c.json(resp, 200);
        }

        // Get media metadata to determine if it's a TV show or movie
        const metadata = await findMediaMetadata(mediaFolderPath);
        if (!metadata) {
            const resp: ScrapeResponseBody = {
                error: `Media Metadata Not Found: No metadata found for ${mediaFolderPath}`
            };
            logHttpRespOut(c, resp, 200);
            return c.json(resp, 200);
        }

        const mediaLocalFolderPath = new Path(mediaFolderPath);

        try {
            if (metadata.type === 'tvshow-folder' && metadata.tvShow?.database === 'TMDB') {
                const id = Number.parseInt(metadata.tvShow.id, 10);
                if (!Number.isFinite(id) || id <= 0) {
                    const resp: ScrapeResponseBody = {
                        error: `Invalid Media Type: TV show metadata has no valid TMDB id`
                    };
                    logHttpRespOut(c, resp, 200);
                    return c.json(resp, 200);
                }
                const tvRes = await getTvShow(id);
                if (!tvRes.data || tvRes.error) {
                    const resp: ScrapeResponseBody = {
                        error: `TMDB TV show fetch failed: ${tvRes.error ?? 'no data'}`
                    };
                    logHttpRespOut(c, resp, 200);
                    return c.json(resp, 200);
                }
                await scrape.everythingForTvShow(mediaLocalFolderPath, tvRes.data);
            } else if (metadata.type === 'movie-folder' && metadata.movie?.database === 'TMDB') {
                const id = Number.parseInt(metadata.movie.id, 10);
                if (!Number.isFinite(id) || id <= 0) {
                    const resp: ScrapeResponseBody = {
                        error: `Invalid Media Type: Movie metadata has no valid TMDB id`
                    };
                    logHttpRespOut(c, resp, 200);
                    return c.json(resp, 200);
                }
                const movieDetails = await getMovie(id);
                await scrape.everythingForMovie(mediaLocalFolderPath, movieDetails);
            } else {
                const resp: ScrapeResponseBody = {
                    error: `Invalid Media Type: Media metadata does not contain valid TMDB TV show or movie data`
                };
                logHttpRespOut(c, resp, 200);
                return c.json(resp, 200);
            }

            const resp: ScrapeResponseBody = {};
            logHttpRespOut(c, resp, 200);
            return c.json(resp, 200);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const resp: ScrapeResponseBody = {
                error: `Scrape Failed: ${errorMessage}`
            };
            logHttpRespOut(c, resp, 200);
            return c.json(resp, 200);
        }
    });
}

