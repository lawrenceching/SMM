import type { UIMediaMetadata } from "@/types/UIMediaMetadata";
import { Path } from "@core/path";
import { createInitialMediaMetadata } from "./mediaMetadataUtils";
import { isNil } from "es-toolkit";

interface InitializeMusicFolderOptions {
    addMediaFolderInUserConfig: (traceId: string, folderInPlatformPath: string) => void;
    getMediaMetadata: (folderInPlatformPath: string) => UIMediaMetadata | undefined;
    addMediaMetadata: (mediaMetadata: UIMediaMetadata) => void;
    traceId: string;
}

export async function initializeMusicFolder(folderInPlatformPath: string, opts: InitializeMusicFolderOptions) {
    const { addMediaFolderInUserConfig, getMediaMetadata, addMediaMetadata, traceId } = opts;

    addMediaFolderInUserConfig(traceId, folderInPlatformPath);
    console.log(`[${traceId}] add "${folderInPlatformPath}" to user config`);

    const mm = getMediaMetadata(Path.posix(folderInPlatformPath));

    if (isNil(mm)) {
        const newMM = await createInitialMediaMetadata(
            folderInPlatformPath, 
            'music-folder', 
            { 
                traceId,
                mediaMetadataProps: {
                    status: 'ok',
                }
            }
        );
        addMediaMetadata(newMM);
        console.log(`[${traceId}] Imported music folder and create media metadata for folder "${folderInPlatformPath}"`);
    } else {
        console.log(`[${traceId}] Imported music folder "${folderInPlatformPath}" and skip creating media metadata because it already exists`);
    }
}