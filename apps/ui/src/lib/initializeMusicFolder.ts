import type { UIMediaMetadata } from "@/types/UIMediaMetadata";
import { Path } from "@core/path";
import { createInitialMediaMetadata } from "./mediaMetadataUtils";
import { isNil } from "es-toolkit";

interface InitializeMusicFolderOptions {
    addMediaFolderInUserConfig: (traceId: string, folderInPlatformPath: string) => void;
    getMediaMetadata: (folderInPlatformPath: string) => UIMediaMetadata | undefined;
    addMediaMetadata: (mediaMetadata: UIMediaMetadata) => void;
    /** When provided, used to replace an existing placeholder (status === 'initializing') with full metadata. */
    updateMediaMetadata?: (folderPath: string, metadata: UIMediaMetadata) => Promise<void>;
    traceId: string;
}

export async function initializeMusicFolder(folderInPlatformPath: string, opts: InitializeMusicFolderOptions) {
    const { addMediaFolderInUserConfig, getMediaMetadata, addMediaMetadata, updateMediaMetadata, traceId } = opts;

    addMediaFolderInUserConfig(traceId, folderInPlatformPath);
    console.log(`[${traceId}] add "${folderInPlatformPath}" to user config`);

    const pathPosix = Path.posix(folderInPlatformPath);
    const mm = getMediaMetadata(pathPosix);

    if (isNil(mm)) {
        const newMM = await createInitialMediaMetadata(
            folderInPlatformPath,
            'music-folder',
            {
                traceId,
                mediaMetadataProps: {
                    status: 'ok',
                },
            }
        );
        addMediaMetadata(newMM);
        console.log(`[${traceId}] Imported music folder and create media metadata for folder "${folderInPlatformPath}"`);
        return;
    }

    if (mm.status === 'initializing' && updateMediaMetadata) {
        const newMM = await createInitialMediaMetadata(
            folderInPlatformPath,
            'music-folder',
            {
                traceId,
                mediaMetadataProps: {
                    status: 'ok',
                },
            }
        );
        await updateMediaMetadata(pathPosix, newMM);
        console.log(`[${traceId}] Imported music folder and updated placeholder with full metadata for folder "${folderInPlatformPath}"`);
        return;
    }

    console.log(`[${traceId}] Imported music folder "${folderInPlatformPath}" and skip creating media metadata because it already exists`);
}