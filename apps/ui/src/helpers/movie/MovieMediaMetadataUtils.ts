import type { MediaMetadata } from "@/lib/mediaFolderFiles";
import { videoFileExtensions } from "../../lib/utils";
import { extname } from "../../lib/path";
export function findMediaFilesForMovieMediaMetadata(
  mediaMetadata: MediaMetadata,
  folderFiles: string[],
): MediaMetadata {
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

    if(folderFiles.length === 0) {
        console.log('[findMediaFilesForMovieMediaMetadata] No files found in media folder, skipping post processing', {
            mediaFolderPath: mediaMetadata.mediaFolderPath,
        });
        return mediaMetadata
    }

    const videoFiles = findVideoFiles(folderFiles);
    
    return {
      ...mediaMetadata,
      mediaFiles: videoFiles.map(path => ({
        absolutePath: path,
      })),
    }
}

export function findVideoFiles(paths: string[]): string[] {
    return paths.filter(path => {
        return videoFileExtensions.includes(extname(path).toLowerCase());
    })
}
