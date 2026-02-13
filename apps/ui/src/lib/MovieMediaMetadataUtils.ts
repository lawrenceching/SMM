import type { MediaMetadata } from "@core/types";
import { videoFileExtensions } from "./utils";
import { extname } from "./path";
export function findMediaFilesForMovieMediaMetadata(mediaMetadata: MediaMetadata): MediaMetadata {
    if(!mediaMetadata.mediaFolderPath) {

        console.log('[findMediaFilesForMovieMediaMetadata] Media folder path is required, skipping post processing');
        return mediaMetadata
    }

    if(mediaMetadata.tmdbMediaType !== 'movie') {
        console.log('[findMediaFilesForMovieMediaMetadata] Media metadata is not a movie, skipping post processing', {
            mediaFolderPath: mediaMetadata.mediaFolderPath,
        });
        return mediaMetadata
    }

    if(mediaMetadata.files === undefined || mediaMetadata.files === null || mediaMetadata.files.length === 0) {
        console.log('[findMediaFilesForMovieMediaMetadata] No files found in media folder, skipping post processing', {
            mediaFolderPath: mediaMetadata.mediaFolderPath,
        });
        return mediaMetadata
    }

    const videoFiles = findVideoFiles(mediaMetadata.files);
    
    mediaMetadata.mediaFiles = videoFiles.map(path => ({
        absolutePath: path,
    }))

    return mediaMetadata;
}

export function findVideoFiles(paths: string[]): string[] {
    return paths.filter(path => {
        return videoFileExtensions.includes(extname(path).toLowerCase());
    })
}