import type { MediaMetadataWithFolderFiles } from "@/lib/mediaFolderFiles";
import { getMediaFolderFiles } from "@/lib/mediaFolderFiles";
import { videoFileExtensions } from "../../lib/utils";
import { extname } from "../../lib/path";
export function findMediaFilesForMovieMediaMetadata(mediaMetadata: MediaMetadataWithFolderFiles): MediaMetadataWithFolderFiles {
    if(!mediaMetadata.mediaFolderPath) {

        console.log('[findMediaFilesForMovieMediaMetadata] Media folder path is required, skipping post processing');
        return mediaMetadata
    }

    if(mediaMetadata.type !== 'movie-folder') {
        console.log('[findMediaFilesForMovieMediaMetadata] Media metadata is not a movie, skipping post processing', {
            mediaFolderPath: mediaMetadata.mediaFolderPath,
        });
        return mediaMetadata
    }

    const folderFiles = getMediaFolderFiles(mediaMetadata)
    if(folderFiles.length === 0) {
        console.log('[findMediaFilesForMovieMediaMetadata] No files found in media folder, skipping post processing', {
            mediaFolderPath: mediaMetadata.mediaFolderPath,
        });
        return mediaMetadata
    }

    const videoFiles = findVideoFiles(folderFiles);
    
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