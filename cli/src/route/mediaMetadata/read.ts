import type { MediaMetadata, ProblemDetails, ReadMediaMetadataRequestBody, ReadMediaMetadataResponseBody } from "@core/types";
import type { Hono } from "hono";
import { stat } from "node:fs/promises";
import { Path } from "@core/path";
import { listFiles } from "@/utils/files";
import { findMediaMetadata } from "@/utils/mediaMetadata";
import { metadataCacheFilePath } from "./utils";
import { mediaMetadataToString } from "lib/log";
import pino from "pino"
const logger = pino()

export async function newMediaMetadata(folderPath: Path) {
    const metadata: MediaMetadata = {
        mediaFolderPath: folderPath.abs(),
        mediaName: '',
        officalMediaName: '',
        files: [],
        mediaFiles: [],
        poster: undefined,
        tmdbTVShowId: undefined,
        seasons: undefined,
    }

    const files = await listFiles(folderPath, true)
    metadata.files = files

    return metadata
}

export async function handleReadMediaMetadata(app: Hono) {
    app.post('/api/readMediaMetadata', async (c) => {
        const raw = await c.req.json() as ReadMediaMetadataRequestBody;
        console.log(`[HTTP_IN] ${c.req.method} ${c.req.url} ${JSON.stringify(raw)}`)
        const folderPath = raw.path;

        // Check if folder exists
        try {
            const stats = await stat(folderPath);
            if (!stats.isDirectory()) {
                const resp: ReadMediaMetadataResponseBody = {
                    data: {} as MediaMetadata,
                    error: `Folder Not Found: ${folderPath} is not a directory`
                };
                console.log(`[HTTP_OUT] ${c.req.method} ${c.req.url} ${JSON.stringify(resp)}`)
                return c.json(resp, 200);
            }
        } catch (error) {
            // Folder doesn't exist or can't be accessed
            const resp: ReadMediaMetadataResponseBody = {
                data: {} as MediaMetadata,
                error: `Folder Not Found: ${folderPath} was not found`
            };
            console.log(`[HTTP_OUT] ${c.req.method} ${c.req.url} ${JSON.stringify(resp)}`)
            return c.json(resp, 200);
        }

        // Use findMediaMetadata to get the metadata
        const data = await findMediaMetadata(folderPath);
        
        if (!data) {
            const metadataFilePath = metadataCacheFilePath(Path.posix(folderPath));
            console.error(`[ReadMediaMetadata] Media Metadata Not Found: ${metadataFilePath} was not found`)
            const resp: ReadMediaMetadataResponseBody = {
                data: undefined,
                error: `Media Metadata Not Found: ${metadataFilePath} was not found`
            };
            return c.json(resp, 200);
        }

        // Update files list from the actual folder
        data.files = await listFiles(new Path(folderPath), true);

        const resp: ReadMediaMetadataResponseBody = {
            data
        };
        // console.log(`[HTTP_OUT][${c.req.method} ${c.req.url}] ${mediaMetadataToString(resp.data)}`)
        return c.json(resp, 200);
    });
}

