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


function blankMediaMetadata(path: string): MediaMetadata {
    return {
        mediaFolderPath: path,
        files: [],
        mediaFiles: [],
        poster: undefined,
        tmdbTVShowId: undefined,
        seasons: undefined,
    } as MediaMetadata;
}

export async function readMediaMetadataV2(pathPosix: string): Promise<MediaMetadata> {
  
    const systemConfig = await hello();
    const mediaMetadataFilePath = metadataCacheFilePath(systemConfig.appDataDir, pathPosix);
    const readFileResponseBody = await readFile(mediaMetadataFilePath);

    let mediaMetadata: MediaMetadata = blankMediaMetadata(pathPosix);

    if(readFileResponseBody.error) {
        if(isError(readFileResponseBody.error, FileNotFoundError)) {
            console.warn(`[readMediaMetadataV2] media metadata file not found: ${mediaMetadataFilePath}, skip a blank media metadata`)
        } else {
            console.error(`[readMediaMetadataV2] unexpected response body: ${readFileResponseBody.error}`);
        }
    }

    if(readFileResponseBody.data) { 
        mediaMetadata = JSON.parse(readFileResponseBody.data) as MediaMetadata;
    } else {
        console.error(`[readMediaMetadataV2] unexpected response body: no data`);
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

    console.log(`[readMediaMetadataV2] read media metadata: ${pathPosix}`, mediaMetadata);

    return mediaMetadata;
}