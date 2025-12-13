import type { DeleteMediaMetadataRequestBody, DeleteMediaMetadataResponseBody } from "@core/types";
import type { Hono } from "hono";
import { metadataCacheFilePath } from "./utils";

export async function handleDeleteMediaMetadata(app: Hono) {
    app.post('/api/deleteMediaMetadata', async (c) => {
        const raw = await c.req.json() as DeleteMediaMetadataRequestBody;
        console.log(`[HTTP_IN] ${c.req.method} ${c.req.url} ${JSON.stringify(raw)}`)
        const folderPath = raw.path;

        if (!folderPath) {
            const resp: DeleteMediaMetadataResponseBody = {
                error: 'Invalid Request: path is required'
            };
            console.log(`[HTTP_OUT] ${c.req.method} ${c.req.url} ${JSON.stringify(resp)}`)
            return c.json(resp, 200);
        }

        const metadataFilePath = metadataCacheFilePath(folderPath);
        const fileExists = await Bun.file(metadataFilePath).exists();

        if (!fileExists) {
            const resp: DeleteMediaMetadataResponseBody = {
                error: `Metadata Not Found: metadata file not found for path ${folderPath}`
            };
            console.log(`[HTTP_OUT] ${c.req.method} ${c.req.url} ${JSON.stringify(resp)}`)
            return c.json(resp, 200);
        }

        // Delete metadata file
        try {
            await Bun.file(metadataFilePath).unlink();
            console.log(`[DeleteMediaMetadata] Deleted metadata file: ${metadataFilePath}`)
            const resp: DeleteMediaMetadataResponseBody = {};
            console.log(`[HTTP_OUT] ${c.req.method} ${c.req.url} ${JSON.stringify(resp)}`)
            return c.json(resp, 200);
        } catch (error) {
            const resp: DeleteMediaMetadataResponseBody = {
                error: `Delete File Failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
            console.log(`[HTTP_OUT] ${c.req.method} ${c.req.url} ${JSON.stringify(resp)}`)
            return c.json(resp, 200);
        }
    });
}

