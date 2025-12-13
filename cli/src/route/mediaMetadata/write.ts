import type { MediaMetadata, WriteMediaMetadataRequestBody, WriteMediaMetadataResponseBody } from "@core/types";
import type { Hono } from "hono";
import { mkdir } from "fs/promises";
import { mediaMetadataDir, metadataCacheFilePath } from "./utils";

export async function handleWriteMediaMetadata(app: Hono) {
    app.post('/api/writeMediaMetadata', async (c) => {
        const raw = await c.req.json() as WriteMediaMetadataRequestBody;
        console.log(`[HTTP_IN] ${c.req.method} ${c.req.url} ${JSON.stringify(raw)}`)
        const metadata = raw.data;

        if (!metadata.mediaFolderPath) {
            const resp: WriteMediaMetadataResponseBody = {
                data: {} as MediaMetadata,
                error: 'Invalid Request: mediaFolderPath is required in metadata'
            };
            console.log(`[HTTP_OUT] ${c.req.method} ${c.req.url} ${JSON.stringify(resp)}`)
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
            console.log(`[HTTP_OUT] ${c.req.method} ${c.req.url} ${JSON.stringify(resp)}`)
            return c.json(resp, 200);
        }

        // Write metadata to file
        try {
            await Bun.write(metadataFilePath, JSON.stringify(metadata, null, 2));
            console.log(`[WriteMediaMetadata] Written metadata to file: ${metadataFilePath}`)
            const resp: WriteMediaMetadataResponseBody = {
                data: metadata
            };
            console.log(`[HTTP_OUT] ${c.req.method} ${c.req.url} ${JSON.stringify(resp)}`)
            return c.json(resp, 200);
        } catch (error) {
            const resp: WriteMediaMetadataResponseBody = {
                data: {} as MediaMetadata,
                error: `Write File Failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
            console.log(`[HTTP_OUT] ${c.req.method} ${c.req.url} ${JSON.stringify(resp)}`)
            return c.json(resp, 200);
        }
    });
}

