import type { MediaMetadata } from "@core/types";


/**
 * Rename file in media metadata, which means:
 * @param mediaMetadata 
 * @param from 
 * @param to 
 * @returns new media metadata with the file renamed
 */
export function renameFileInMediaMetadata(mediaMetadata: MediaMetadata, from: string, to: string): MediaMetadata {
    const clone = structuredClone(mediaMetadata);
    
    clone.files = clone.files?.map(file => {
        if (file === from) {
            return to;
        }
        return file;
    });

    clone.mediaFiles = clone.mediaFiles?.map(mediaFile => {
        if (mediaFile.absolutePath === from) {
            return {
                ...mediaFile,
                absolutePath: to
            };
        }
        return mediaFile;
    });

    return clone;
}