import type { MediaMetadata } from "@core/types";
import { Path } from "@core/path";
import pino from "pino";

const logger = pino();


/**
 * Rename media folder in media metadata, which means:
 * 1. Rename folder in mediaMetadata.files
 * 2. Rename folder in mediaMetadata.mediaFiles.absolutePath
 * 
 * This method assumes the "from" and "to" path are valid.
 * Devleoper need to do validation before calling this method.
 * 
 * @param mediaMetadata 
 * @param from - the origin folder absolute path in POSIX format
 * @param to - the new folder absolute path in POSIX format
 * @returns new media metadata with the folder renamed
 */
export function renameMediaFolderInMediaMetadata(mediaMetadata: MediaMetadata, from: string, to: string): MediaMetadata {
    logger.info({
        from,
        to,
        mediaMetadata
    }, `Renaming folder in media metadata: ${from} to ${to}`);
    
    const clone = structuredClone(mediaMetadata);
    
    // Helper function to replace folder prefix in a path
    const replaceFolderPrefix = (path: string): string => {
        const normalizedPath = Path.posix(path);
        
        // Check if path starts with the folder path (with trailing slash or exact match)
        if (normalizedPath === from || normalizedPath.startsWith(from + '/')) {
            // Replace the folder prefix
            return normalizedPath.replace(from, to);
        }
        return path;
    };
    
    // Update mediaFolderPath if it matches
    if (clone.mediaFolderPath) {
        const normalizedMediaFolderPath = Path.posix(clone.mediaFolderPath);
        if (normalizedMediaFolderPath === from) {
            clone.mediaFolderPath = to;
        }
    }
    
    // Update files array
    clone.files = clone.files?.map(file => replaceFolderPrefix(file));
    
    // Update mediaFiles array
    clone.mediaFiles = clone.mediaFiles?.map(mediaFile => {
        const updatedAbsolutePath = replaceFolderPrefix(mediaFile.absolutePath);
        
        // Update subtitleFilePaths if they exist
        const updatedSubtitlePaths = mediaFile.subtitleFilePaths?.map(path => replaceFolderPrefix(path));
        
        // Update audioFilePaths if they exist
        const updatedAudioPaths = mediaFile.audioFilePaths?.map(path => replaceFolderPrefix(path));
        
        // Only create a new object if something changed
        if (updatedAbsolutePath !== mediaFile.absolutePath ||
            updatedSubtitlePaths !== mediaFile.subtitleFilePaths ||
            updatedAudioPaths !== mediaFile.audioFilePaths) {
            return {
                ...mediaFile,
                absolutePath: updatedAbsolutePath,
                subtitleFilePaths: updatedSubtitlePaths,
                audioFilePaths: updatedAudioPaths
            };
        }
        return mediaFile;
    });
    
    logger.info({
        clone,
    }, `Updated media metadata after folder rename`);
    return clone;
}


/**
 * Rename file in media metadata, which means:
 * @param mediaMetadata 
 * @param from 
 * @param to 
 * @returns new media metadata with the file renamed
 */
export function renameFileInMediaMetadata(mediaMetadata: MediaMetadata, from: string, to: string): MediaMetadata {
    logger.info({
        from,
        to,
        mediaMetadata
    }, `Renaming file in media metadata: ${from} to ${to}`);
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

    logger.info({
        clone,
    }, `Updated media metadata after single rename`);
    return clone;
}