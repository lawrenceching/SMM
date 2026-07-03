import type { MediaMetadata } from "@core/types";
import { writeFile } from "./writeFile";
import { metadataCacheFilePath } from "./readMediaMetadataV2";
import { hello } from "./hello";
import { logger } from "@/lib/log";

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
    const start = performance.now()
    await writeFile(dstPath, JSON.stringify(dst, null, 4))
    const durationMs = Math.round(performance.now() - start)

    logger.info({
        traceId,
        stage: 'mediaMetadataRepository.write',
        folder: mediaMetadata.mediaFolderPath,
        type: mediaMetadata.type,
        mediaFileCount: mediaMetadata.mediaFiles?.length ?? 0,
        path: dstPath,
        durationMs,
    }, 'writeMediaMetadata: persisted')
}