import { extname, basename } from './path';
import { videoFileExtensions } from './utils';

/**
 * Find the video files for a given season and episode.
 * @param files The file paths in POSIX format
 * @param seasonNumber 
 * @param episodeNumber 
 */
export function lookup(files: string[], seasonNumber: number, episodeNumber: number): string | null {
    const keyword = `S${seasonNumber.toString().padStart(2, '0')}E${episodeNumber.toString().padStart(2, '0')}`;
    
    // 1. filter video files
    const videoFiles = files.filter(file => {
        const ext = extname(file).toLowerCase();
        return videoFileExtensions.includes(ext);
    });
    
    // 2. filter files by keyword (case-insensitive)
    const matchingFiles = videoFiles.filter(file => {
        const filename = basename(file) || file;
        return filename.toUpperCase().includes(keyword.toUpperCase());
    });
    
    // 3. return the first file
    return matchingFiles.length > 0 ? matchingFiles[0] : null;
}