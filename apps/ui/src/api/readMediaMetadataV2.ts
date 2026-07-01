import type { MediaMetadata } from "@core/types";
import { hello } from "./hello";
import { readFile } from "./readFile";
import { join } from "@/lib/path";
import { FileNotFoundError, isError } from "@core/errors";
import { listFiles } from "./listFiles";
import { Path } from "@core/path";

export function metadataCacheFilePath(appDataDir: string, folderPathInPosix: string) {
    const filename = folderPathInPosix.replace(/[\/\\:?*|<>"]/g, '_')
    return join(appDataDir, `metadata`,  `${filename}.json`)
}


function blankMediaMetadata(path: string, defaultType?: MediaMetadata["type"]): MediaMetadata {
    const mm: MediaMetadata = {
        mediaFolderPath: path,
        files: [],
        mediaFiles: [],
    }
    if (defaultType) mm.type = defaultType
    return mm
}

export async function readMediaMetadataV2(pathPosix: string, { traceId, defaultType }: { traceId?: string; defaultType?: MediaMetadata["type"] } = {}): Promise<MediaMetadata> {
  
    const systemConfig = await hello();
    const mediaMetadataFilePath = metadataCacheFilePath(systemConfig.appDataDir, pathPosix);
    const readFileResponseBody = await readFile(mediaMetadataFilePath);

    let mediaMetadata: MediaMetadata = blankMediaMetadata(pathPosix, defaultType);

    if(readFileResponseBody.error) {
        if(isError(readFileResponseBody.error, FileNotFoundError)) {
            console.warn(`[readMediaMetadataV2]${traceId ? ` [${traceId}]` : ''} media metadata file not found: ${mediaMetadataFilePath}, skip a blank media metadata`)
        } else {
            console.error(`[readMediaMetadataV2]${traceId ? ` [${traceId}]` : ''} unexpected response body: ${readFileResponseBody.error}`);
        }
    }

    if(readFileResponseBody.data) { 
        mediaMetadata = JSON.parse(readFileResponseBody.data) as MediaMetadata;
    } else {
        console.error(`[readMediaMetadataV2]${traceId ? ` [${traceId}]` : ''} unexpected response body: no data`);
    }

    const listFilesResponseBody = await listFiles({
        path: pathPosix,
        recursively: true,
        onlyFiles: true,
    });

    if(listFilesResponseBody.data !== undefined ) {
        // Handle both old format (strings) and new format (objects with path property)
        mediaMetadata.files = listFilesResponseBody.data.items.map(i => {
            const path = typeof i === 'string' ? i : i.path;
            return Path.posix(path);
        });
    }

    console.log(`[readMediaMetadataV2]${traceId ? ` [${traceId}]` : ''} read media metadata: ${pathPosix}`, mediaMetadata);

    return mediaMetadata;
}