import type { Hono } from "hono";
import { stat } from "node:fs/promises";
import { Path } from "@core/path";
import type { ScrapeRequestBody, ScrapeResponseBody } from "@core/types";
import scrape from "@/utils/scrape";
import { findMediaMetadata } from "@/utils/mediaMetadata";

export async function handleScrapeRequest(app: Hono) {
    app.post('/api/scrape', async (c) => {
        const raw = await c.req.json() as ScrapeRequestBody;
        console.log(`[HTTP_IN] ${c.req.method} ${c.req.url} ${JSON.stringify(raw)}`);
        
        const { mediaFolderPath } = raw;

        // Validate request
        if (!mediaFolderPath) {
            const resp: ScrapeResponseBody = {
                error: 'Invalid Request: mediaFolderPath is required'
            };
            console.log(`[HTTP_OUT] ${c.req.method} ${c.req.url} ${JSON.stringify(resp)}`);
            return c.json(resp, 200);
        }

        // Check if folder exists
        try {
            const stats = await stat(mediaFolderPath);
            if (!stats.isDirectory()) {
                const resp: ScrapeResponseBody = {
                    error: `Folder Not Found: ${mediaFolderPath} is not a directory`
                };
                console.log(`[HTTP_OUT] ${c.req.method} ${c.req.url} ${JSON.stringify(resp)}`);
                return c.json(resp, 200);
            }
        } catch (error) {
            const resp: ScrapeResponseBody = {
                error: `Folder Not Found: ${mediaFolderPath} was not found`
            };
            console.log(`[HTTP_OUT] ${c.req.method} ${c.req.url} ${JSON.stringify(resp)}`);
            return c.json(resp, 200);
        }

        // Get media metadata to determine if it's a TV show or movie
        const metadata = await findMediaMetadata(mediaFolderPath);
        if (!metadata) {
            const resp: ScrapeResponseBody = {
                error: `Media Metadata Not Found: No metadata found for ${mediaFolderPath}`
            };
            console.log(`[HTTP_OUT] ${c.req.method} ${c.req.url} ${JSON.stringify(resp)}`);
            return c.json(resp, 200);
        }

        const mediaLocalFolderPath = new Path(mediaFolderPath);

        try {
            // Scrape based on media type
            if (metadata.tmdbMediaType === 'tv' && metadata.tmdbTvShow) {
                await scrape.everythingForTvShow(mediaLocalFolderPath, metadata.tmdbTvShow);
            } else if (metadata.tmdbMediaType === 'movie' && metadata.tmdbMovie) {
                await scrape.everythingForMovie(mediaLocalFolderPath, metadata.tmdbMovie);
            } else {
                const resp: ScrapeResponseBody = {
                    error: `Invalid Media Type: Media metadata does not contain valid TMDB TV show or movie data`
                };
                console.log(`[HTTP_OUT] ${c.req.method} ${c.req.url} ${JSON.stringify(resp)}`);
                return c.json(resp, 200);
            }

            const resp: ScrapeResponseBody = {};
            console.log(`[HTTP_OUT] ${c.req.method} ${c.req.url} ${JSON.stringify(resp)}`);
            return c.json(resp, 200);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const resp: ScrapeResponseBody = {
                error: `Scrape Failed: ${errorMessage}`
            };
            console.error(`[HTTP_OUT] ${c.req.method} ${c.req.url} ${JSON.stringify(resp)}`);
            return c.json(resp, 200);
        }
    });
}

