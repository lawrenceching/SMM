import { mkdir, rename } from 'fs/promises';
import { Path } from '@core/path';
import type { MediaMetadata } from '@core/types';
import { validatePathWithinMediaFolder } from '../validations/validatePathWithinMediaFolder';
import { validateSourceFileExist } from '../validations/validateSourceFileExist';
import { validateDestFileNotExist } from '../validations/validateDestFileNotExist';
import { validateNoAbnormalPaths } from '../validations/validateNoAbnormalPaths';
import { broadcastMessage } from './websocketManager';
import { metadataCacheFilePath, mediaMetadataDir } from '../route/mediaMetadata/utils';
import { renameFileInMediaMetadata } from './mediaMetadataUtils';
// Import updateMediaMetadataAfterRename from renameFilesInBatch for batch operations
// Note: This function handles multiple renames, while renameFileInMediaMetadata handles single rename
import { updateMediaMetadataAfterRename } from '../tools/renameFilesInBatch';
import pino from 'pino';

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

    // Ensure target directory exists
    // Handle case where file is at root level (parent() throws error)
    let toDirPlatform: string | null = null;
    try {
      const toDir = new Path(to).parent();
      toDirPlatform = toDir.platformAbsPath();
    } catch (error) {
      // If parent() throws "reaching parent folder is not allowed", 
      // it means the file is at root level, so no directory creation needed
      if (error instanceof Error && error.message === 'reaching parent folder is not allowed') {
        toDirPlatform = null; // File is at root, no directory to create
      } else {
        throw error; // Re-throw if it's a different error
      }
    }

    if (dryRun) {
      logger.info({
        from: fromPathPlatform,
        to: toPathPlatform,
        clientId
      }, `${logPrefix} Dry run: Would rename file from "${from}" to "${to}"`);
      return { success: true };
    }

    // Create directory only if not at root level
    if (toDirPlatform !== null) {
      await mkdir(toDirPlatform, { recursive: true });
    }

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
      const { from, to } = renameMappings[0];
      updatedMediaMetadata = renameFileInMediaMetadata(
        mediaMetadata,
        Path.posix(from),
        Path.posix(to)
      );
    } else {
      // Multiple renames - use batch utility
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

