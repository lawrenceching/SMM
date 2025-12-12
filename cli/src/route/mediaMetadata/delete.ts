import type { ProblemDetails, DeleteMediaMetadataRequestBody, DeleteMediaMetadataResponseBody } from "@core/types";
import type { Hono } from "hono";
import { metadataCacheFilePath } from "./utils";

export async function handleDeleteMediaMetadata(app: Hono) {
    app.post('/api/deleteMediaMetadata', async (c) => {
        const raw = await c.req.json() as DeleteMediaMetadataRequestBody;
        console.log(`[HTTP_IN] ${c.req.method} ${c.req.url} ${JSON.stringify(raw)}`)
        const folderPath = raw.path;

        if (!folderPath) {
            const problemDetails: ProblemDetails = {
                type: 'https://www.example.com/problemdetails/types/unexpected-error',
                title: 'Invalid Request',
                status: 400,
                detail: 'path is required',
                instance: c.req.url,
            };
            console.log(`[HTTP_OUT] ${c.req.method} ${c.req.url} ${JSON.stringify(problemDetails)}`)
            return c.json(problemDetails, 400);
        }

        const metadataFilePath = metadataCacheFilePath(folderPath);
        const fileExists = await Bun.file(metadataFilePath).exists();

        if (!fileExists) {
            const problemDetails: ProblemDetails = {
                type: 'https://www.example.com/problemdetails/types/unexpected-error',
                title: 'Not Found',
                status: 404,
                detail: `Metadata file not found for path: ${folderPath}`,
                instance: c.req.url,
            };
            console.log(`[HTTP_OUT] ${c.req.method} ${c.req.url} ${JSON.stringify(problemDetails)}`)
            return c.json(problemDetails, 404);
        }

        // Delete metadata file
        try {
            await Bun.file(metadataFilePath).unlink();
            console.log(`[DeleteMediaMetadata] Deleted metadata file: ${metadataFilePath}`)
            const resp: DeleteMediaMetadataResponseBody = {};
            console.log(`[HTTP_OUT] ${c.req.method} ${c.req.url} ${JSON.stringify(resp)}`)
            return c.json(resp, 200);
        } catch (error) {
            const problemDetails: ProblemDetails = {
                type: 'https://www.example.com/problemdetails/types/unexpected-error',
                title: 'Internal Server Error',
                status: 500,
                detail: `Failed to delete metadata file: ${error instanceof Error ? error.message : 'Unknown error'}`,
                instance: c.req.url,
            };
            console.log(`[HTTP_OUT] ${c.req.method} ${c.req.url} ${JSON.stringify(problemDetails)}`)
            return c.json(problemDetails, 500);
        }
    });
}

