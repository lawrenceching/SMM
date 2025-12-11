import type { MediaMetadata, ProblemDetails, ReadMediaMetadataRequestBody, ReadMediaMetadataResponseBody } from "@core/types";
import type { Hono } from "hono";
import { getUserDataDir } from "tasks/HelloTask";
import path, { join } from "path";
import { Path } from "@core/path";
import { listFiles } from "@/utils/files";

const userDataDir = getUserDataDir();
const mediaMetadataDir = path.join(userDataDir, 'metadata');

export function metadataCacheFilePath(folderPath: string) {
    const filename = folderPath.replace(/[\/\\:?*|<>"]/g, '_')
    return join(mediaMetadataDir, `${filename}.json`)
}

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

        if(await Bun.file(folderPath).exists()) {
            const problemDetails: ProblemDetails = {
                type: 'https://www.example.com/problemdetails/types/unexpected-error',
                title: 'File Not Found',
                status: 404,
                detail: `Folder not found: ${folderPath}`,
                instance: c.req.url,
            };
            console.log(`[HTTP_OUT] ${c.req.method} ${c.req.url} ${JSON.stringify(problemDetails)}`)
            return c.json(problemDetails, 404);
        }

        const metadataFilePath = path.join(mediaMetadataDir, metadataCacheFilePath(folderPath));
        const isExist = await Bun.file(metadataFilePath).exists();
        if(!isExist) {
            const metadata = await newMediaMetadata(new Path(folderPath));
            console.log(`[HTTP_OUT] ${c.req.method} ${c.req.url} ${JSON.stringify(metadata)}`)
            return c.json({
                data: metadata
            } as ReadMediaMetadataResponseBody, 201);
        } else {

            const data = await Bun.file(metadataFilePath).json();
            const resp = {
                data
            } as ReadMediaMetadataResponseBody;
            console.log(`[HTTP_OUT] ${c.req.method} ${c.req.url} ${JSON.stringify(resp)}`)
            return c.json(resp);

        }

    });
}