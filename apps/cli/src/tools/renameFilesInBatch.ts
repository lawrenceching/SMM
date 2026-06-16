import { z } from 'zod/v3';
import { Path } from '@core/path';
import type { MediaMetadata, RenameValidationResult } from '@core/types';
import { updateMediaMetadataAfterRename } from '@core/mediaMetadata';
import { validateRenameOperationsSync } from '@core/validations/rename/validateRenameOperationsSync';
import { metadataCacheFilePath } from '../route/mediaMetadata/utils';
import { executeBatchRenameOperations, updateMediaMetadataAndBroadcast } from '../utils/renameFileUtils';
import { validateSourceFileExist } from '../validations/validateSourceFileExist';
import { validateDestFileNotExist } from '../validations/validateDestFileNotExist';
import pino from 'pino';
import { askForRenameFilesConfirmation } from '@/events/askForRenameFilesConfirmation';

const logger = pino();

interface RenameFile {
  from: string;
  to: string;
}

/** @deprecated Use RenameValidationResult from @core/types instead */
export interface ValidationResult {
  validationErrors: string[];
  validatedRenames: RenameFile[];
}



/**
 * Validate rename operations using validation functions from validations folder
 * @param files Array of rename operations to validate
 * @param folderPathInPosix The media folder path in POSIX format
 * @param filesystemFiles Array of files currently in the filesystem (unused, kept for compatibility)
 * @returns RenameValidationResult with isValid flag, errors array, and validated renames
 */
export async function validateRenameOperations(
  files: RenameFile[],
  folderPathInPosix: string,
): Promise<RenameValidationResult> {
  const normalizedTasks: RenameFile[] = [];

  for (let i = 0; i < files.length; i++) {
    const renameOp = files[i];
    if (!renameOp) {
      logger.warn({ index: i }, '[tool][renameFilesInBatch] Undefined rename operation at index, skipping');
      continue;
    }

    normalizedTasks.push({
      from: Path.posix(renameOp.from),
      to: Path.posix(renameOp.to),
    });
  }

  if (normalizedTasks.length === 0) {
    return {
      isValid: true,
      errors: [],
      validatedRenames: [],
    };
  }

  const syncResult = validateRenameOperationsSync(normalizedTasks, folderPathInPosix);
  const errors = [...syncResult.errors];

  const sourceExistResult = await validateSourceFileExist(normalizedTasks);
  if (!sourceExistResult.isValid) {
    for (const missingFile of sourceExistResult.missingFiles) {
      logger.warn({ from: missingFile }, '[tool][renameFilesInBatch] Source file not found');
      errors.push(`Source file "${missingFile}" does not exist in the media folder`);
    }
  }

  const destNotExistResult = await validateDestFileNotExist(normalizedTasks);
  if (!destNotExistResult.isValid) {
    for (const existingFile of destNotExistResult.existingFiles) {
      logger.warn({ to: existingFile }, '[tool][renameFilesInBatch] Target file already exists in filesystem');
      errors.push(`Target file "${existingFile}" already exists in the filesystem`);
    }
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
      validatedRenames: [],
    };
  }

  return syncResult;
}

export { updateMediaMetadataAfterRename };

export const createRenameFilesInBatchTool = (clientId: string, abortSignal?: AbortSignal) => ({
  description: `Rename multiple files in a media folder in batch.
This tool accepts an array of file rename operations (from/to paths) and will ask for user confirmation before renaming.
Once confirmed, it will rename the files on the filesystem and update the media metadata accordingly.

Example: Rename multiple files in folder "/path/to/media/folder".
This tool return JSON response with the following format:

`,
  toolName: 'renameFilesInBatch',
  inputSchema: z.object({
    folderPath: z.string().describe("The absolute path of the media folder, it can be POSIX format or Windows format"),
    files: z.array(z.object({
      from: z.string().describe("The current absolute path of the file to rename, it can be POSIX format or Windows format"),
      to: z.string().describe("The new absolute path for the file, it can be POSIX format or Windows format"),
    })).describe("Array of file rename operations"),
  }),
  timeout: 10000,
  execute: async ({ folderPath, files }: {
    folderPath: string;
    files: RenameFile[];
  }) => {
    // TODO: Implement abort handling - check abortSignal and cancel ongoing operations
    if (abortSignal?.aborted) {
      throw new Error('Request was aborted');
    }
    logger.info({
      folderPath,
      totalFiles: files.length
    }, '[tool][renameFilesInBatch] Starting batch rename operation');

    const folderPathInPosix = Path.posix(folderPath);

    // 1. Read media metadata from cache file
    const metadataFilePath = metadataCacheFilePath(folderPathInPosix);
    const metadataExists = await Bun.file(metadataFilePath).exists();

    if (!metadataExists) {
      logger.warn({
        folderPath: folderPathInPosix
      }, '[tool][renameFilesInBatch] Media metadata not found');
      return { error: `Error Reason: folderPath "${folderPathInPosix}" is not opened in SMM` };
    }

    let mediaMetadata: MediaMetadata;
    try {
      mediaMetadata = await Bun.file(metadataFilePath).json() as MediaMetadata;
    } catch (error) {
      logger.error({
        folderPath: folderPathInPosix,
        error: error instanceof Error ? error.message : String(error)
      }, '[tool][renameFilesInBatch] Failed to read media metadata');
      return { error: `Error Reason: Failed to read media metadata: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }

    // 2. Check if folderPathInPosix matches
    if (mediaMetadata.mediaFolderPath !== folderPathInPosix) {
      logger.warn({
        providedPath: folderPathInPosix,
        metadataPath: mediaMetadata.mediaFolderPath
      }, '[tool][renameFilesInBatch] Folder path mismatch');
      return { error: `Error Reason: folderPath "${folderPathInPosix}" does not match metadata folder path "${mediaMetadata.mediaFolderPath}"` };
    }

    // 3. Validate all rename operations before asking for confirmation
    logger.info({
      folderPath: folderPathInPosix,
      totalFiles: files.length
    }, '[tool][renameFilesInBatch] Starting validation');

    const validationResult = await validateRenameOperations(files, folderPathInPosix);

    logger.info({
      totalFiles: files.length,
      validatedRenames: validationResult.validatedRenames.length,
      validationErrors: validationResult.errors.length
    }, '[tool][renameFilesInBatch] Validation complete');

    // If there are validation errors, return them
    if (!validationResult.isValid) {
      logger.error({
        validationErrors: validationResult.errors,
        totalErrors: validationResult.errors.length
      }, '[tool][renameFilesInBatch] Validation failed');
      return { error: `Error Reason: Validation failed:\n${validationResult.errors.join('\n')}` };
    }

    const validatedRenames = validationResult.validatedRenames;
    if (validatedRenames.length === 0) {
      logger.warn('[tool][renameFilesInBatch] No valid rename operations');
      return { error: `Error Reason: No valid files to rename` };
    }

    // TODO: Check abortSignal before asking for confirmation
    if (abortSignal?.aborted) {
      throw new Error('Request was aborted');
    }

    // 5. Ask for user confirmation
    const getFilename = (path: string) => {
      const pathInPosix = Path.posix(path);
      const parts = pathInPosix.split('/').filter(p => p);
      return parts[parts.length - 1] || pathInPosix;
    };
    
    try {
      // TODO: Check abortSignal during confirmation wait
      const posixFiles = files.map(file => ({
        from: Path.posix(file.from),
        to: Path.posix(file.to),
      }));
      const confirmed = await askForRenameFilesConfirmation(clientId, posixFiles);

      if (!confirmed) {
        logger.info('[tool][renameFilesInBatch] User cancelled the operation');
        return { error: 'User cancelled the operation' };
      }
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error)
      }, '[tool][renameFilesInBatch] Error getting confirmation');
      return { error: `Error Reason: Failed to get user confirmation: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }

    // TODO: Check abortSignal before executing rename operations
    if (abortSignal?.aborted) {
      throw new Error('Request was aborted');
    }

    // 6. Perform rename operations on filesystem
    logger.info({
      validatedCount: validatedRenames.length,
      clientId
    }, '[tool][renameFilesInBatch] Starting batch rename execution');

    // TODO: Check abortSignal during batch rename execution
    const renameResult = await executeBatchRenameOperations(validatedRenames, {
      dryRun: false,
      clientId,
      logPrefix: '[tool][renameFilesInBatch]',
    });

    if (!renameResult.success) {
      logger.error({
        totalFiles: files.length,
        failedCount: renameResult.errors?.length || 0,
        successfulCount: renameResult.successfulRenames?.length || 0,
        clientId
      }, '[tool][renameFilesInBatch] Batch rename execution failed');
      return { error: `Error Reason: Some rename operations failed:\n${renameResult.errors?.join('\n') || 'Unknown error'}` };
    }

    const successfulRenames = renameResult.successfulRenames || [];
    if (successfulRenames.length === 0) {
      logger.warn({
        clientId
      }, '[tool][renameFilesInBatch] No files were successfully renamed');
      return { error: `Error Reason: No files were successfully renamed` };
    }

    // TODO: Check abortSignal before updating metadata
    if (abortSignal?.aborted) {
      throw new Error('Request was aborted');
    }

    // 7. Update media metadata with new file paths and broadcast
    
    if (successfulRenames.length > 0) {
      // TODO: Check abortSignal during metadata update
      const metadataUpdateResult = await updateMediaMetadataAndBroadcast(
        folderPathInPosix,
        successfulRenames,
        {
          dryRun: false,
          clientId,
          logPrefix: '[tool][renameFilesInBatch]',
        }
      );

      if (!metadataUpdateResult.success) {
        logger.error({
          folderPath: folderPathInPosix,
          error: metadataUpdateResult.error
        }, '[tool][renameFilesInBatch] Failed to update media metadata');
        return { error: `Error Reason: Failed to write media metadata: ${metadataUpdateResult.error}` };
      }
    }

    logger.info({
      folderPath: folderPathInPosix,
      totalRenamed: successfulRenames.length
    }, '[tool][renameFilesInBatch] Batch rename operation completed successfully');

    return {
      error: undefined
    };
  },
});

