import { mkdir, rename, stat } from 'fs/promises';
import { Path } from '@core/path';
import type { MediaMetadata } from '@core/types';
import { broadcast } from './socketIO';
import { metadataCacheFilePath, mediaMetadataDir } from '../route/mediaMetadata/utils';
import { renameMediaFolderInMediaMetadata } from './mediaMetadataUtils';
import { updateMediaMetadataAfterRename } from '../tools/renameFilesInBatch';
import pino from 'pino';
import { dirname } from 'path';

const logger = pino();

async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stats = await stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Execute multiple file rename operations in batch
 * @param renameMappings Array of validated rename operations
 * @param options Execution options
 * @returns Result with success status and aggregated errors if any operations fail
 */
export async function executeBatchRenameOperations(
  renameMappings: Array<{ from: string; to: string }>,
  options: {
    dryRun?: boolean;
    clientId?: string;
    logPrefix?: string;
  } = {}
): Promise<{ success: boolean; errors?: string[]; successfulRenames?: Array<{ from: string; to: string }> }> {
  const { dryRun = false, clientId, logPrefix = '[executeBatchRenameOperations]' } = options;

  if (renameMappings.length === 0) {
    return {
      success: false,
      errors: ['No rename operations provided'],
    };
  }

  const errors: string[] = [];
  const successfulRenames: Array<{ from: string; to: string }> = [];

  logger.info({
    totalOperations: renameMappings.length,
    clientId,
    dryRun
  }, `${logPrefix} Starting batch rename execution`);

  // Execute all rename operations sequentially
  for (const renameMapping of renameMappings) {
    const result = await executeRenameOperation(
      renameMapping.from,
      renameMapping.to,
      {
        dryRun,
        clientId,
        logPrefix,
      }
    );

    if (result.success) {
      successfulRenames.push(renameMapping);
    } else {
      errors.push(`Failed to rename "${renameMapping.from}" to "${renameMapping.to}": ${result.error || 'Unknown error'}`);
    }
  }

  if (errors.length > 0) {
    logger.error({
      totalOperations: renameMappings.length,
      failedOperations: errors.length,
      successfulOperations: successfulRenames.length,
      clientId
    }, `${logPrefix} Some rename operations failed`);
    
    return {
      success: false,
      errors,
      successfulRenames: successfulRenames.length > 0 ? successfulRenames : undefined,
    };
  }

  logger.info({
    totalOperations: renameMappings.length,
    clientId
  }, `${logPrefix} All rename operations completed successfully`);

  return {
    success: true,
    successfulRenames,
  };
}

/**
 * Execute a single file rename operation on the filesystem
 * @param from Source file path
 * @param to Destination file path
 * @param options Execution options
 * @returns Result with success status and optional error message
 */
export async function executeRenameOperation(
  from: string,
  to: string,
  options: {
    dryRun?: boolean;
    clientId?: string;
    logPrefix?: string;
  } = {}
): Promise<{ success: boolean; error?: string }> {
  const { dryRun = false, clientId, logPrefix = '[executeRenameOperation]' } = options;

  const fromPathPlatform = new Path(from).platformAbsPath();
  const toPathPlatform = new Path(to).platformAbsPath();

  try {


    if (dryRun) {
      logger.info({
        from: fromPathPlatform,
        to: toPathPlatform,
        clientId
      }, `${logPrefix} Dry run: Would rename file from "${from}" to "${to}"`);
      return { success: true };
    }

    // Create directory only if not at root level
    // Using recursive: true ensures all parent directories are created if they don't exist
    const destDir = dirname(toPathPlatform);
    
    try {
      // Create the directory recursively
      await mkdir(destDir, { recursive: true });
      
      // Verify the directory was actually created
      const dirExistsAfterMkdir = await directoryExists(destDir);

      if (!dirExistsAfterMkdir) {
        throw new Error(`Directory creation failed silently. Path: ${destDir}`);
      }
    } catch (mkdirError) {
      logger.error({
        destDir,
        error: mkdirError instanceof Error ? mkdirError.message : String(mkdirError),
        errorStack: mkdirError instanceof Error ? mkdirError.stack : undefined,
        clientId
      }, `${logPrefix} Failed to create target directory`);
      throw mkdirError;
    }

    // Perform the rename
    logger.info({
      from: fromPathPlatform,
      to: toPathPlatform,
      clientId
    }, `${logPrefix} Renaming file`);
    await rename(fromPathPlatform, toPathPlatform);

    logger.info({
      from,
      to,
      clientId
    }, `${logPrefix} File renamed successfully`);

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error({
      fromPathPlatform,
      toPathPlatform,
      destDir: dirname(toPathPlatform),
      error: errorMessage,
      errorStack,
      clientId
    }, `${logPrefix} Failed to rename file`);

    if(errorMessage.includes('ENOENT: no such file or directory')) {
      const isSourceExists = await Bun.file(fromPathPlatform).exists();
      if(!isSourceExists) {
        logger.error({
          from: fromPathPlatform,
          clientId
        }, `${logPrefix} Source file does not exist`);
        return {
          success: false,
          error: `Source file does not exist: ${fromPathPlatform}`,
        };
      } else {
        const destDir = dirname(toPathPlatform);
        const isDestDirExists = await directoryExists(destDir);
        if(!isDestDirExists) {
          const parentDir = dirname(destDir);
          const parentExists = await directoryExists(parentDir);
          
          logger.error({
            destDir,
            parentDir,
            parentExists,
            clientId
          }, `${logPrefix} Destination directory does not exist despite mkdir attempt`);
          
          let errorMsg = `Destination directory does not exist and could not be created: ${destDir}`;
          if (parentExists) {
            errorMsg += `\nParent directory exists but child directory creation failed. This might be due to special characters in the path or permission issues.`;
          } else {
            errorMsg += `\nParent directory also does not exist: ${parentDir}`;
          }
          
          return {
            success: false,
            error: errorMsg,
          };
        } else {
          logger.error({
            from: fromPathPlatform,
            to: toPathPlatform,
            clientId
          }, `${logPrefix} Destination directory exists but rename still failed`);
          return {
            success: false,
            error: `Failed to rename file. The destination file name may contain invalid characters or there may be permission issues.`,
          };
        }
      }
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Update media metadata and broadcast the update event
 * @param mediaFolder Media folder path (POSIX format)
 * @param renameMappings Array of rename operations (from/to paths)
 * @param options Update options
 * @returns Result with success status and optional error message
 */
export async function updateMediaMetadataAndBroadcast(
  mediaFolder: string,
  renameMappings: Array<{ from: string; to: string }>,
  options: {
    dryRun?: boolean;
    clientId?: string;
    logPrefix?: string;
  } = {}
): Promise<{ success: boolean; error?: string }> {
  const { dryRun = false, clientId, logPrefix = '[updateMediaMetadataAndBroadcast]' } = options;

  if (dryRun) {
    logger.info({
      mediaFolder,
      renameCount: renameMappings.length,
      clientId
    }, `${logPrefix} Dry run: Would update media metadata`);
    return { success: true };
  }

  const metadataFilePath = metadataCacheFilePath(mediaFolder);
  const metadataExists = await Bun.file(metadataFilePath).exists();

  if (!metadataExists) {
    logger.debug({
      mediaFolder,
      clientId
    }, `${logPrefix} Media metadata file does not exist, skipping update`);
    return { success: true }; // Not an error if metadata doesn't exist
  }

  try {
    const mediaMetadata = await Bun.file(metadataFilePath).json() as MediaMetadata;

    // Verify the mediaFolder path matches
    if (mediaMetadata.mediaFolderPath !== mediaFolder) {
      logger.warn({
        providedPath: mediaFolder,
        metadataPath: mediaMetadata.mediaFolderPath,
        clientId
      }, `${logPrefix} Folder path mismatch, skipping metadata update`);
      return {
        success: false,
        error: `Folder path mismatch: provided "${mediaFolder}" but metadata has "${mediaMetadata.mediaFolderPath}"`,
      };
    }

    // Update metadata with renamed files (always use batch version for consistency)
    logger.info({
      renameMappings,
      renameCount: renameMappings.length,
      clientId
    }, `${logPrefix} Updating media metadata after rename`);
    const updatedMediaMetadata = updateMediaMetadataAfterRename(mediaMetadata, renameMappings);

    // Write updated metadata back to file
    await mkdir(mediaMetadataDir, { recursive: true });
    await Bun.write(metadataFilePath, JSON.stringify(updatedMediaMetadata, null, 2));

    logger.info({
      mediaFolder,
      renameCount: renameMappings.length,
      clientId
    }, `${logPrefix} Successfully updated media metadata`);

    // Broadcast mediaMetadataUpdated event to all connected clients
    broadcast({
      clientId: clientId,
      event: 'mediaMetadataUpdated',
      data: {
        folderPath: mediaFolder
      }
    });

    logger.info({
      mediaFolder,
      clientId
    }, `${logPrefix} Broadcasted mediaMetadataUpdated event`);

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({
      mediaFolder,
      error: errorMessage,
      clientId
    }, `${logPrefix} Failed to update media metadata`);
    
    // Return error but don't throw - metadata update failure shouldn't fail the rename
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Update media metadata after folder rename and broadcast the update event
 * Handles the case where the media folder itself is being renamed
 * @param mediaFolder Media folder path (POSIX format) - the folder being renamed or its parent
 * @param from Source folder path (POSIX format)
 * @param to Destination folder path (POSIX format)
 * @param options Update options
 * @returns Result with success status and optional error message
 */
export async function updateMediaMetadataAfterFolderRename(
  mediaFolder: string,
  from: string,
  to: string,
  options: {
    dryRun?: boolean;
    clientId?: string;
    logPrefix?: string;
  } = {}
): Promise<{ success: boolean; error?: string }> {
  const { dryRun = false, clientId, logPrefix = '[updateMediaMetadataAfterFolderRename]' } = options;

  if (dryRun) {
    logger.info({
      mediaFolder,
      from,
      to,
      clientId
    }, `${logPrefix} Dry run: Would update media metadata after folder rename`);
    return { success: true };
  }

  const fromNormalized = Path.posix(from);
  const toNormalized = Path.posix(to);
  const mediaFolderNormalized = Path.posix(mediaFolder);

  // Determine if the media folder itself is being renamed
  const isMediaFolderRename = fromNormalized === mediaFolderNormalized;

  // Find the metadata file - use the original mediaFolder path
  const metadataFilePath = metadataCacheFilePath(mediaFolderNormalized);
  const metadataExists = await Bun.file(metadataFilePath).exists();

  if (!metadataExists) {
    logger.debug({
      mediaFolder: mediaFolderNormalized,
      clientId
    }, `${logPrefix} Media metadata file does not exist, skipping update`);
    return { success: true }; // Not an error if metadata doesn't exist
  }

  try {
    const mediaMetadata = await Bun.file(metadataFilePath).json() as MediaMetadata;

    // Verify the mediaFolder path matches
    if (mediaMetadata.mediaFolderPath !== mediaFolderNormalized) {
      logger.warn({
        providedPath: mediaFolderNormalized,
        metadataPath: mediaMetadata.mediaFolderPath,
        clientId
      }, `${logPrefix} Folder path mismatch, skipping metadata update`);
      return {
        success: false,
        error: `Folder path mismatch: provided "${mediaFolderNormalized}" but metadata has "${mediaMetadata.mediaFolderPath}"`,
      };
    }

    // Update metadata with renamed folder
    logger.info({
      from: fromNormalized,
      to: toNormalized,
      isMediaFolderRename,
      clientId
    }, `${logPrefix} Renaming folder in media metadata: ${fromNormalized} to ${toNormalized}`);
    
    const updatedMediaMetadata = renameMediaFolderInMediaMetadata(
      mediaMetadata,
      fromNormalized,
      toNormalized
    );

    logger.info({
      updatedMediaMetadata,
      clientId
    }, `${logPrefix} Updated media metadata after folder rename`);

    // If the media folder itself is being renamed, we need to move the metadata file
    if (isMediaFolderRename) {
      const newMetadataFilePath = metadataCacheFilePath(toNormalized);
      
      // Write updated metadata to new location
      await mkdir(mediaMetadataDir, { recursive: true });
      await Bun.write(newMetadataFilePath, JSON.stringify(updatedMediaMetadata, null, 2));
      
      // Remove old metadata file
      try {
        await Bun.file(metadataFilePath).unlink();
        logger.info({
          oldPath: metadataFilePath,
          newPath: newMetadataFilePath,
          clientId
        }, `${logPrefix} Moved metadata file to new location`);
      } catch (error) {
        logger.warn({
          oldPath: metadataFilePath,
          error: error instanceof Error ? error.message : String(error),
          clientId
        }, `${logPrefix} Failed to remove old metadata file (non-critical)`);
      }

      // Broadcast with new folder path
      broadcast({
        event: 'mediaMetadataUpdated',
        data: {
          folderPath: toNormalized
        }
      });

      logger.info({
        from: fromNormalized,
        to: toNormalized,
        clientId
      }, `${logPrefix} Broadcasted mediaMetadataUpdated event for renamed media folder`);
    } else {
      // Write updated metadata back to same file
      await mkdir(mediaMetadataDir, { recursive: true });
      await Bun.write(metadataFilePath, JSON.stringify(updatedMediaMetadata, null, 2));

      // Broadcast with original media folder path
      broadcast({
        event: 'mediaMetadataUpdated',
        data: {
          folderPath: mediaFolderNormalized
        }
      });

      logger.info({
        mediaFolder: mediaFolderNormalized,
        clientId
      }, `${logPrefix} Broadcasted mediaMetadataUpdated event`);
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({
      mediaFolder: mediaFolderNormalized,
      from: fromNormalized,
      to: toNormalized,
      error: errorMessage,
      clientId
    }, `${logPrefix} Failed to update media metadata after folder rename`);
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

