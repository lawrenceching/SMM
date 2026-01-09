import type { MediaMetadata } from "@core/types"
import { Path } from "@core/path"
import { metadataCacheFilePath } from "../route/mediaMetadata/utils"
import pino from "pino"
import { unlink } from "fs/promises"

const logger = pino()

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

export async function writeMediaMetadata(mediaMetadata: MediaMetadata): Promise<void> {
    if(!mediaMetadata.mediaFolderPath) {
        throw new Error('Media folder path is required')
    }
    const metadataFilePath = metadataCacheFilePath(mediaMetadata.mediaFolderPath)
    logger.info({
        metadataFilePath,
        mediaMetadata,
    }, '[writeMediaMetadata] Writing media metadata to file');
    await Bun.write(metadataFilePath, JSON.stringify(mediaMetadata, null, 2))
}

export async function deleteMediaMetadataFile(mediaFolderPath: string): Promise<void> {
    const metadataFilePath = metadataCacheFilePath(mediaFolderPath)
    logger.info({
        metadataFilePath,
    }, '[deleteMediaMetadataFile] Deleting media metadata file');
    await unlink(metadataFilePath)
}
