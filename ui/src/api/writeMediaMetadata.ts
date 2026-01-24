import type { MediaMetadata } from "@core/types";
import { writeFile } from "./writeFile";
import { metadataCacheFilePath } from "./readMediaMetadataV2";
import { hello } from "./hello";

export async function writeMediaMetadata(mediaMetadata: MediaMetadata, { traceId }: { traceId?: string} = {}): Promise<void> {

    if(!mediaMetadata.mediaFolderPath) {
        throw new Error('Media folder path is required');
    }

    if(mediaMetadata.type === undefined) {
        console.warn(`[writeMediaMetadata]${traceId ? ` [${traceId}]` : ''} media metadata type is undefined`);
    }
    
    const systemConfig = await hello();
    const appDataDir = systemConfig.appDataDir;
    const dst = structuredClone(mediaMetadata) as MediaMetadata
    dst.files = []
    
    const dstPath = metadataCacheFilePath(appDataDir, mediaMetadata.mediaFolderPath!)
    await writeFile(dstPath, JSON.stringify(dst, null, 4))
}