import type { MediaMetadata } from "@core/types";
import { writeFile } from "./writeFile";
import { metadataCacheFilePath } from "./readMediaMetadataV2";
import { hello } from "./hello";

export async function writeMediaMetadata(mediaMetadata: MediaMetadata): Promise<void> {

    if(!mediaMetadata.mediaFolderPath) {
        throw new Error('Media folder path is required');
    }
    
    const systemConfig = await hello();
    const appDataDir = systemConfig.appDataDir;
    const dst = structuredClone(mediaMetadata) as MediaMetadata
    dst.files = []
    
    const dstPath = metadataCacheFilePath(appDataDir, mediaMetadata.mediaFolderPath!)
    await writeFile(dstPath, JSON.stringify(dst, null, 4))
}