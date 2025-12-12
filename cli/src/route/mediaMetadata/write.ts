import type { MediaMetadata, ProblemDetails, WriteMediaMetadataRequestBody, WriteMediaMetadataResponseBody } from "@core/types";
import type { Hono } from "hono";
import { mkdir } from "fs/promises";
import { mediaMetadataDir, metadataCacheFilePath } from "./utils";

export async function handleWriteMediaMetadata(app: Hono) {
    app.post('/api/writeMediaMetadata', async (c) => {
        const raw = await c.req.json() as WriteMediaMetadataRequestBody;
        console.log(`[HTTP_IN] ${c.req.method} ${c.req.url} ${JSON.stringify(raw)}`)
        const metadata = raw.data;

        if (!metadata.mediaFolderPath) {
            const problemDetails: ProblemDetails = {
                type: 'https://www.example.com/problemdetails/types/unexpected-error',
                title: 'Invalid Request',
                status: 400,
                detail: 'mediaFolderPath is required in metadata',
                instance: c.req.url,
            };
            console.log(`[HTTP_OUT] ${c.req.method} ${c.req.url} ${JSON.stringify(problemDetails)}`)
            return c.json(problemDetails, 400);
        }

        const metadataFilePath = metadataCacheFilePath(metadata.mediaFolderPath);
        
        // Ensure the metadata directory exists
        try {
            await mkdir(mediaMetadataDir, { recursive: true });
        } catch (error) {
            const problemDetails: ProblemDetails = {
                type: 'https://www.example.com/problemdetails/types/unexpected-error',
                title: 'Internal Server Error',
                status: 500,
                detail: `Failed to create metadata directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
                instance: c.req.url,
            };
            console.log(`[HTTP_OUT] ${c.req.method} ${c.req.url} ${JSON.stringify(problemDetails)}`)
            return c.json(problemDetails, 500);
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
            const problemDetails: ProblemDetails = {
                type: 'https://www.example.com/problemdetails/types/unexpected-error',
                title: 'Internal Server Error',
                status: 500,
                detail: `Failed to write metadata file: ${error instanceof Error ? error.message : 'Unknown error'}`,
                instance: c.req.url,
            };
            console.log(`[HTTP_OUT] ${c.req.method} ${c.req.url} ${JSON.stringify(problemDetails)}`)
            return c.json(problemDetails, 500);
        }
    });
}

