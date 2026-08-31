import type { MediaMetadata } from "@smm/types";
import { Path } from "@smm/utils/path";
import { createInitialMediaMetadata } from "./mediaMetadataUtils";
import { isNil } from "es-toolkit";

interface InitializeMusicFolderOptions {
    addMediaFolderInUserConfig: (traceId: string, folderInPlatformPath: string) => void;
    getMediaMetadata: (folderInPlatformPath: string) => MediaMetadata | undefined;
    addMediaMetadata: (mediaMetadata: MediaMetadata) => void;
    /** When provided, used to replace an existing placeholder with full metadata. */
    updateMediaMetadata?: (folderPath: string, metadata: MediaMetadata) => Promise<void>;
    isInitializing?: (folderInPlatformPath: string) => boolean;
    traceId: string;
}

/**
 * @deprecated
 * @param folderInPlatformPath 
 * @param opts 
 * @returns 
 */
export async function initializeMusicFolder(folderInPlatformPath: string, opts: InitializeMusicFolderOptions) {
    const { addMediaFolderInUserConfig, getMediaMetadata, addMediaMetadata, updateMediaMetadata, isInitializing, traceId } = opts;

    addMediaFolderInUserConfig(traceId, folderInPlatformPath);
    console.log(`[${traceId}] add "${folderInPlatformPath}" to user config`);

    const pathPosix = Path.posix(folderInPlatformPath);
    const mm = getMediaMetadata(pathPosix);

    if (isNil(mm)) {
        const newMM = await createInitialMediaMetadata(
            folderInPlatformPath,
            'music-folder',
            { traceId },
        );
        addMediaMetadata(newMM);
        console.log(`[${traceId}] Imported music folder and create media metadata for folder "${folderInPlatformPath}"`);
        return;
    }

    if (isInitializing?.(pathPosix) && updateMediaMetadata) {
        const newMM = await createInitialMediaMetadata(
            folderInPlatformPath,
            'music-folder',
            { traceId },
        );
        await updateMediaMetadata(pathPosix, newMM);
        console.log(`[${traceId}] Imported music folder and updated placeholder with full metadata for folder "${folderInPlatformPath}"`);
        return;
    }

    console.log(`[${traceId}] Imported music folder "${folderInPlatformPath}" and skip creating media metadata because it already exists`);
}
