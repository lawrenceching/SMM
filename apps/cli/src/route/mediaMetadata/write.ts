import type { MediaMetadata, WriteMediaMetadataRequestBody, WriteMediaMetadataResponseBody } from "@core/types";
import type { Hono } from "hono";
import { mkdir } from "fs/promises";
import { mediaMetadataDir, metadataCacheFilePath } from "./utils";
import { logger, logHttpReqIn, logHttpRespOut } from "../../../lib/logger";

export async function handleWriteMediaMetadata(app: Hono) {
    app.post('/api/writeMediaMetadata', async (c) => {
        const raw = await c.req.json() as WriteMediaMetadataRequestBody;
        logHttpReqIn(c, raw);
        const metadata = raw.data;

        if (!metadata.mediaFolderPath) {
            const resp: WriteMediaMetadataResponseBody = {
                data: {} as MediaMetadata,
                error: 'Invalid Request: mediaFolderPath is required in metadata'
            };
            logger.warn({ folder: metadata.mediaFolderPath }, '[writeMediaMetadata] rejected: missing mediaFolderPath');
            logHttpRespOut(c, resp, 200);
            return c.json(resp, 200);
        }

        const metadataFilePath = metadataCacheFilePath(metadata.mediaFolderPath);

        // Ensure the metadata directory exists
        try {
            await mkdir(mediaMetadataDir, { recursive: true });
        } catch (error) {
            const resp: WriteMediaMetadataResponseBody = {
                data: {} as MediaMetadata,
                error: `Create Directory Failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
            logger.error({ err: error, folder: metadata.mediaFolderPath, dir: mediaMetadataDir }, '[writeMediaMetadata] mkdir failed');
            logHttpRespOut(c, resp, 200);
            return c.json(resp, 200);
        }

        // Write metadata to file
        try {
            await Bun.write(metadataFilePath, JSON.stringify(metadata, null, 2));
            logger.info({
                folder: metadata.mediaFolderPath,
                type: metadata.type,
                fileCount: metadata.files?.length ?? 0,
                mediaFileCount: metadata.mediaFiles?.length ?? 0,
                path: metadataFilePath,
            }, '[writeMediaMetadata] persisted');
            const resp: WriteMediaMetadataResponseBody = {
                data: metadata
            };
            logHttpRespOut(c, resp, 200);
            return c.json(resp, 200);
        } catch (error) {
            const resp: WriteMediaMetadataResponseBody = {
                data: {} as MediaMetadata,
                error: `Write File Failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
            logger.error({ err: error, folder: metadata.mediaFolderPath, path: metadataFilePath }, '[writeMediaMetadata] Bun.write failed');
            logHttpRespOut(c, resp, 200);
            return c.json(resp, 200);
        }
    });
}

