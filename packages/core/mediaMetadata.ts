import { Path } from "./path";
import type { MediaMetadata } from "./types";

/**
 * Rename media folder in media metadata, which means:
 * 1. Rename mediaMetadata.mediaFolderPath
 * 2. Rename folder in mediaMetadata.files
 * 3. Rename folder in mediaMetadata.mediaFiles.absolutePath
 *
 * This method assumes the "from" and "to" path are valid.
 * Devleoper need to do validation before calling this method.
 *
 * @param mediaMetadata
 * @param from - POSIX format path (e.g., "/media/tvshow")
 * @param to - POSIX format path (e.g., "/media/tvshow-renamed")
 */
export function renameFolderInMediaMetadata(mediaMetadata: MediaMetadata, from: string, to: string): MediaMetadata {
    // Normalize the from path to ensure it ends with / for proper prefix matching
    const fromNormalized = from.endsWith('/') ? from : from + '/';
    const toNormalized = to.endsWith('/') ? to : to + '/';

    const result: MediaMetadata = structuredClone(mediaMetadata);

    // 1. Rename mediaFolderPath
    if (result.mediaFolderPath) {
        const mediaFolderPathNormalized = result.mediaFolderPath.endsWith('/') 
            ? result.mediaFolderPath 
            : result.mediaFolderPath + '/';
        
        if (result.mediaFolderPath === fromNormalized.slice(0, -1)) {
            // Exact match: replace the entire path
            result.mediaFolderPath = toNormalized.slice(0, -1);
        } else if (mediaFolderPathNormalized.startsWith(fromNormalized)) {
            // Prefix match: replace the prefix portion
            result.mediaFolderPath = toNormalized + result.mediaFolderPath.slice(fromNormalized.length);
        }
    }

    // 2. Rename folder in mediaMetadata.files
    if (result.files) {
        result.files = result.files.map(file => {
            if (file.startsWith(fromNormalized)) {
                return toNormalized + file.slice(fromNormalized.length);
            }
            return file;
        });
    }

    // 3. Rename folder in mediaMetadata.mediaFiles.absolutePath
    if (result.mediaFiles) {
        result.mediaFiles = result.mediaFiles.map(mediaFile => {
            if (mediaFile.absolutePath.startsWith(fromNormalized)) {
                return {
                    ...mediaFile,
                    absolutePath: toNormalized + mediaFile.absolutePath.slice(fromNormalized.length)
                };
            }
            return mediaFile;
        });
    }

    return result;
}

export function createMediaMetadata(
    folderPathInPlatformFormat: string, 
    type: "music-folder" | "tvshow-folder" | "movie-folder",
    props: Partial<MediaMetadata> = {}) {

    const mm: MediaMetadata = {
        mediaFolderPath: Path.posix(folderPathInPlatformFormat),
        type,
        ...props,
    }

    return mm;
}