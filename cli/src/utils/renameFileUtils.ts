import { mkdir, rename, stat } from 'fs/promises';
import { Path } from '@core/path';
import type { MediaMetadata } from '@core/types';
import { validatePathWithinMediaFolder } from '../validations/validatePathWithinMediaFolder';
import { validateSourceFileExist } from '../validations/validateSourceFileExist';
import { validateDestFileNotExist } from '../validations/validateDestFileNotExist';
import { validateNoAbnormalPaths } from '../validations/validateNoAbnormalPaths';
import { broadcastMessage } from './websocketManager';
import { metadataCacheFilePath, mediaMetadataDir } from '../route/mediaMetadata/utils';
import { renameFileInMediaMetadata, renameMediaFolderInMediaMetadata } from './mediaMetadataUtils';
// Import updateMediaMetadataAfterRename from renameFilesInBatch for batch operations
// Note: This function handles multiple renames, while renameFileInMediaMetadata handles single rename
import { updateMediaMetadataAfterRename, validateRenameOperations } from '../tools/renameFilesInBatch';
import pino from 'pino';
import { dirname } from 'path';

const logger = pino();

/**
 * Validate a single file rename operation
 * @param from Source file path
 * @param to Destination file path
 * @param mediaFolder Media folder path
 * @returns Validation result with error message if invalid
 */
export async function validateSingleRenameOperation(
  from: string,
  to: string,
  mediaFolder: string
): Promise<{ isValid: boolean; error?: string }> {
  // 1. Validate no abnormal paths (should be first)
  const abnormalPathErrors = validateNoAbnormalPaths([{ from, to }]);
  if (abnormalPathErrors.length > 0) {
    return {
      isValid: false,
      error: `Invalid Path: ${abnormalPathErrors.join('; ')}`,
    };
  }

  // 2. Validate paths are within media folder
  const pathWithinFolderResult = validatePathWithinMediaFolder(mediaFolder, [{ from, to }]);
  if (!pathWithinFolderResult.isValid) {
    const errorMessages = pathWithinFolderResult.invalidPaths.map(
      (invalidPath) => `Path Outside Media Folder: ${invalidPath.type === 'source' ? 'Source' : 'Destination'} path "${invalidPath.path}" is outside the media folder`
    );
    return {
      isValid: false,
      error: errorMessages.join('; '),
    };
  }

  // 3. Validate source file exists
  const sourceExistResult = await validateSourceFileExist([{ from, to }]);
  if (!sourceExistResult.isValid) {
    return {
      isValid: false,
      error: `File Not Found: Source file "${from}" does not exist`,
    };
  }

  // 4. Validate destination file does not exist
  const destNotExistResult = await validateDestFileNotExist([{ from, to }]);
  if (!destNotExistResult.isValid) {
    return {
      isValid: false,
      error: `File Already Exists: Destination file "${to}" already exists`,
    };
  }

  return { isValid: true };
}

/**
 * Validate multiple file rename operations in batch
 * @param files Array of rename operations to validate
 * @param mediaFolder Media folder path
 * @returns Validation result with aggregated errors or success status
 */
export async function validateBatchRenameOperations(
  files: Array<{ from: string; to: string }>,
  mediaFolder: string
): Promise<{ isValid: boolean; errors?: string[]; validatedRenames?: Array<{ from: string; to: string }> }> {
  if (files.length === 0) {
    return {
      isValid: false,
      errors: ['No files provided for batch rename'],
    };
  }

  const mediaFolderInPosix = Path.posix(mediaFolder);
  
  // Reuse validateRenameOperations from tools (filesystemFiles parameter is unused, pass empty array)
  const validationResult = await validateRenameOperations(
    files,
    mediaFolderInPosix,
    []
  );

  if (validationResult.validationErrors.length > 0) {
    return {
      isValid: false,
      errors: validationResult.validationErrors,
    };
  }

  if (validationResult.validatedRenames.length === 0) {
    return {
      isValid: false,
      errors: ['No valid files to rename after validation'],
    };
  }

  return {
    isValid: true,
    validatedRenames: validationResult.validatedRenames,
  };
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

  try {
    const fromPathPlatform = new Path(from).platformAbsPath();
    const toPathPlatform = new Path(to).platformAbsPath();

    // Ensure target directory exists before renaming
    // Handle case where file is at root level (parent() throws error)

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
    const destDir = dirname(to)
    logger.info({
      clientId
    }, `${logPrefix} Ensuring target directory exists: ${destDir}`);
    await mkdir(destDir, { recursive: true });

    // Perform the rename
    await rename(fromPathPlatform, toPathPlatform);

    logger.info({
      from,
      to,
      clientId
    }, `${logPrefix} File renamed successfully`);

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({
      from,
      to,
      error: errorMessage,
      clientId
    }, `${logPrefix} Failed to rename file`);

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

    // Update metadata with renamed files
    let updatedMediaMetadata: MediaMetadata;
    if (renameMappings.length === 1) {
      // Single rename - use simpler utility
      const renameMapping = renameMappings[0];
      if (!renameMapping) {
        throw new Error('Invalid rename mapping: expected single mapping but got undefined');
      }
      const { from, to } = renameMapping;
      logger.info({
        from,
        to,
        clientId
      }, `${logPrefix} Renaming file in media metadata: ${from} to ${to}`);
      updatedMediaMetadata = renameFileInMediaMetadata(
        mediaMetadata,
        Path.posix(from),
        Path.posix(to)
      );

      logger.info({
        updatedMediaMetadata,
        clientId
      }, `${logPrefix} Updated media metadata after single rename`);
    } else {
      // Multiple renames - use batch utility
      logger.info({
        renameMappings,
        mediaMetadata,
        clientId
      }, `${logPrefix} Updating media metadata after multiple renames`);
      updatedMediaMetadata = updateMediaMetadataAfterRename(mediaMetadata, renameMappings);
    }

    // Write updated metadata back to file
    await mkdir(mediaMetadataDir, { recursive: true });
    await Bun.write(metadataFilePath, JSON.stringify(updatedMediaMetadata, null, 2));

    logger.info({
      mediaFolder,
      renameCount: renameMappings.length,
      clientId
    }, `${logPrefix} Successfully updated media metadata`);

    // Broadcast mediaMetadataUpdated event to all connected clients
    broadcastMessage({
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
      broadcastMessage({
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
      broadcastMessage({
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

