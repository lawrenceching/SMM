import type { MediaMetadata } from "@core/types"
import { Path } from "@core/path"
import { metadataCacheFilePath } from "../route/mediaMetadata/utils"

/**
 * Find media metadata by the media folder path.
 * Checks the metadata cache file and returns the metadata if it exists.
 * @param mediaFolderPath - The media folder path (can be in any format, will be converted to POSIX)
 * @returns The MediaMetadata if found, null if the cache file doesn't exist or can't be read
 */
export async function findMediaMetadata(mediaFolderPath: string): Promise<MediaMetadata | null> {
    // Convert to POSIX path format for cache file lookup
    const folderPathInPosix = Path.posix(mediaFolderPath)
    const metadataFilePath = metadataCacheFilePath(folderPathInPosix)
    
    // Check if cache file exists
    const isExist = await Bun.file(metadataFilePath).exists()
    
    if (!isExist) {
        return null
    }
    
    // Read and parse the metadata file
    try {
        const metadata = await Bun.file(metadataFilePath).json() as MediaMetadata
        return metadata
    } catch (error) {
        console.error(`[findMediaMetadata] Error reading metadata from file: ${metadataFilePath}`, error)
        return null
    }
}