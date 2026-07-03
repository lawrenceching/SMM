import type { MediaMetadata, ProblemDetails, ReadMediaMetadataRequestBody, ReadMediaMetadataResponseBody } from "@core/types";
import type { Hono } from "hono";
import { stat } from "node:fs/promises";
import { Path } from "@core/path";
import { listFiles } from "@/utils/files";
import { findMediaMetadata } from "@/utils/mediaMetadata";
import { metadataCacheFilePath } from "./utils";
import { logger, logHttpReqIn, logHttpRespOut } from "../../../lib/logger";

export async function newMediaMetadata(folderPath: Path) {
    const metadata: MediaMetadata = {
        mediaFolderPath: folderPath.abs(),
        files: [],
        mediaFiles: [],
    }

    const files = await listFiles(folderPath, true)
    metadata.files = files

    return metadata
}

export async function handleReadMediaMetadata(app: Hono) {
    app.post('/api/readMediaMetadata', async (c) => {
        const raw = await c.req.json() as ReadMediaMetadataRequestBody;
        logHttpReqIn(c, raw);
        const folderPath = raw.path;

        // Check if folder exists
        try {
            const stats = await stat(folderPath);
            if (!stats.isDirectory()) {
                const resp: ReadMediaMetadataResponseBody = {
                    data: {} as MediaMetadata,
                    error: `Folder Not Found: ${folderPath} is not a directory`
                };
                logger.warn({ folder: folderPath }, '[readMediaMetadata] not a directory');
                logHttpRespOut(c, resp, 200);
                return c.json(resp, 200);
            }
        } catch (error) {
            // Folder doesn't exist or can't be accessed
            const resp: ReadMediaMetadataResponseBody = {
                data: {} as MediaMetadata,
                error: `Folder Not Found: ${folderPath} was not found`
            };
            logger.error({
                err: error,
                folder: folderPath,
            }, '[readMediaMetadata] media folder not found');
            logHttpRespOut(c, resp, 200);
            return c.json(resp, 200);
        }

        // Use findMediaMetadata to get the metadata
        const data = await findMediaMetadata(folderPath);

        if (!data) {
            const metadataFilePath = metadataCacheFilePath(Path.posix(folderPath));
            logger.warn({ folder: folderPath, metadataFilePath }, '[readMediaMetadata] metadata file not found');
            const resp: ReadMediaMetadataResponseBody = {
                data: undefined,
                error: `Media Metadata Not Found: ${metadataFilePath} was not found`
            };
            logHttpRespOut(c, resp, 200);
            return c.json(resp, 200);
        }

        // Update files list from the actual folder
        data.files = await listFiles(new Path(folderPath), true);
        logger.info({
            folder: folderPath,
            type: data.type,
            fileCount: data.files.length,
            tvShowId: data.tvShow?.id,
            movieId: data.movie?.id,
        }, '[readMediaMetadata] served');

        const resp: ReadMediaMetadataResponseBody = {
            data
        };
        logHttpRespOut(c, resp, 200);
        return c.json(resp, 200);
    });
}

