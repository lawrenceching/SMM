import { z } from 'zod';
import { Path } from '@core/path';
import type { MediaFileMetadata, MediaMetadata } from '@core/types';
import { metadataCacheFilePath } from '../route/mediaMetadata/utils';
import { sendAndWaitForResponse } from '../utils/SocketService';
import { validateBatchRenameOperations, executeBatchRenameOperations, updateMediaMetadataAndBroadcast } from '../utils/renameFileUtils';
import { validateChainingConflicts } from '../validations/validateChainingConflicts';
import { validateNoAbnormalPaths } from '../validations/validateNoAbnormalPaths';
import { validateNoDuplicatedSourceFile } from '../validations/validateNoDuplicatedSourceFile';
import { validateNoDuplicatedDestFile } from '../validations/validateNoDuplicatedDestFile';
import { validateNoIdenticalSourceAndDestFile } from '../validations/validateNoIdenticalSourceAndDestFile';
import { validateSourceFileExist } from '../validations/validateSourceFileExist';
import { validateDestFileNotExist } from '../validations/validateDestFileNotExist';
import { validatePathWithinMediaFolder } from '../validations/validatePathWithinMediaFolder';
import pino from 'pino';
import { askForRenameFilesConfirmation } from '@/events/askForRenameFilesConfirmation';

const logger = pino();

interface RenameFile {
  from: string;
  to: string;
}

interface ValidationResult {
  validationErrors: string[];
  validatedRenames: RenameFile[];
}



/**
 * Validate rename operations using validation functions from validations folder
 * @param files Array of rename operations to validate
 * @param folderPathInPosix The media folder path in POSIX format
 * @param filesystemFiles Array of files currently in the filesystem (unused, kept for compatibility)
 * @returns Object containing validation errors and validated rename operations
 */
export async function validateRenameOperations(
  files: RenameFile[],
  folderPathInPosix: string,
  filesystemFiles: string[]
): Promise<ValidationResult> {
  const validationErrors: string[] = [];
  
  // Filter out null/undefined tasks and normalize paths
  const normalizedTasks: RenameFile[] = [];
  const taskIndexMap = new Map<number, number>(); // Maps original index to normalized index
  
  for (let i = 0; i < files.length; i++) {
    const renameOp = files[i];
    if (!renameOp) {
      logger.warn({
        index: i
      }, '[tool][renameFilesInBatch] Undefined rename operation at index, skipping');
      continue;
    }
    
    const fromPathInPosix = Path.posix(renameOp.from);
    const toPathInPosix = Path.posix(renameOp.to);
    
    logger.debug({
      from: renameOp.from,
      fromNormalized: fromPathInPosix,
      to: renameOp.to,
      toNormalized: toPathInPosix,
      index: i
    }, '[tool][renameFilesInBatch] Normalizing rename operation');
    
    taskIndexMap.set(normalizedTasks.length, i);
    normalizedTasks.push({
      from: fromPathInPosix,
      to: toPathInPosix
    });
  }

  if (normalizedTasks.length === 0) {
    return {
      validationErrors: [],
      validatedRenames: []
    };
  }

  // 1. Validate no abnormal paths (should be first)
  const abnormalPathErrors = validateNoAbnormalPaths(normalizedTasks);
  if (abnormalPathErrors.length > 0) {
    validationErrors.push(...abnormalPathErrors);
    // Continue with other validations even if abnormal paths found
  }

  // 2. Validate no duplicate source files
  const duplicateSourceResult = validateNoDuplicatedSourceFile(normalizedTasks);
  if (!duplicateSourceResult.isValid) {
    for (const duplicatePath of duplicateSourceResult.duplicates) {
      const indices: number[] = [];
      normalizedTasks.forEach((task, idx) => {
        if (task.from === duplicatePath) {
          indices.push(taskIndexMap.get(idx) ?? idx);
        }
      });
      validationErrors.push(`Source file "${duplicatePath}" appears multiple times in the batch (at indices ${indices.join(', ')})`);
    }
  }

  // 3. Validate no duplicate destination files
  const duplicateDestResult = validateNoDuplicatedDestFile(normalizedTasks);
  if (!duplicateDestResult.isValid) {
    for (const duplicatePath of duplicateDestResult.duplicates) {
      const indices: number[] = [];
      normalizedTasks.forEach((task, idx) => {
        if (task.to === duplicatePath) {
          indices.push(taskIndexMap.get(idx) ?? idx);
        }
      });
      validationErrors.push(`Target file "${duplicatePath}" appears multiple times in the batch (at indices ${indices.join(', ')})`);
    }
  }

  // 4. Validate no identical source and destination
  const identicalResult = validateNoIdenticalSourceAndDestFile(normalizedTasks);
  if (!identicalResult.isValid) {
    for (const identicalPath of identicalResult.identicals) {
      logger.debug({
        path: identicalPath
      }, '[tool][renameFilesInBatch] From and to paths are the same, skipping');
      // Note: We don't add this as an error, just skip these tasks (matching original behavior)
    }
  }

  // 5. Validate no chaining conflicts
  const sourcePaths = new Set<string>();
  normalizedTasks.forEach(task => sourcePaths.add(task.from));
  const hasChainingConflicts = !validateChainingConflicts(normalizedTasks);
  const chainingConflictTasks = new Set<number>();
  
  if (hasChainingConflicts) {
    // Find the conflicting paths
    normalizedTasks.forEach((task, idx) => {
      if (sourcePaths.has(task.to)) {
        chainingConflictTasks.add(idx);
        validationErrors.push(`Target file "${task.to}" conflicts with a source path in the same batch (cannot chain renames)`);
      }
    });
  }

  // 6. Validate source files exist (async)
  const sourceExistResult = await validateSourceFileExist(normalizedTasks);
  if (!sourceExistResult.isValid) {
    for (const missingFile of sourceExistResult.missingFiles) {
      logger.warn({
        from: missingFile
      }, '[tool][renameFilesInBatch] Source file not found');
      validationErrors.push(`Source file "${missingFile}" does not exist in the media folder`);
    }
  }

  // 7. Validate destination files do not exist (async)
  const destNotExistResult = await validateDestFileNotExist(normalizedTasks);
  if (!destNotExistResult.isValid) {
    for (const existingFile of destNotExistResult.existingFiles) {
      logger.warn({
        to: existingFile
      }, '[tool][renameFilesInBatch] Target file already exists in filesystem');
      validationErrors.push(`Target file "${existingFile}" already exists in the filesystem`);
    }
  }

  // 8. Validate paths are within media folder
  const pathWithinFolderResult = validatePathWithinMediaFolder(folderPathInPosix, normalizedTasks);
  if (!pathWithinFolderResult.isValid) {
    for (const invalidPath of pathWithinFolderResult.invalidPaths) {
      logger.warn({
        path: invalidPath.path,
        type: invalidPath.type,
        folderPath: folderPathInPosix
      }, `[tool][renameFilesInBatch] ${invalidPath.type === 'source' ? 'Source' : 'Target'} path outside media folder`);
      validationErrors.push(
        `${invalidPath.type === 'source' ? 'Source' : 'Target'} path "${invalidPath.path}" is outside the media folder "${folderPathInPosix}"`
      );
    }
  }

  // Build set of invalid tasks based on errors
  const invalidTasks = new Set<number>();
  
  // Mark tasks with errors as invalid
  normalizedTasks.forEach((task, idx) => {
    // Check if this task has any errors
    const hasError = 
      abnormalPathErrors.some(e => e.includes(`"${task.from}"`) || e.includes(`"${task.to}"`)) ||
      duplicateSourceResult.duplicates.includes(task.from) ||
      duplicateDestResult.duplicates.includes(task.to) ||
      identicalResult.identicals.includes(task.from) ||
      sourceExistResult.missingFiles.includes(task.from) ||
      destNotExistResult.existingFiles.includes(task.to) ||
      pathWithinFolderResult.invalidPaths.some(p => p.path === task.from || p.path === task.to) ||
      chainingConflictTasks.has(idx);
    
    if (hasError) {
      invalidTasks.add(idx);
    }
  });

  // Build validated renames list (exclude invalid tasks and identical source/dest)
  const validatedRenames: RenameFile[] = [];
  normalizedTasks.forEach((task, idx) => {
    if (!invalidTasks.has(idx) && task.from !== task.to) {
      validatedRenames.push({
        from: task.from,
        to: task.to
      });
      
      logger.debug({
        from: task.from,
        to: task.to,
        originalIndex: taskIndexMap.get(idx)
      }, '[tool][renameFilesInBatch] Rename operation validation passed');
    }
  });

  return {
    validationErrors,
    validatedRenames
  };
}

/**
 * Update media metadata files array and mediaFiles array after renaming
 */
export function updateMediaMetadataAfterRename(
  mediaMetadata: MediaMetadata,
  renameMappings: Array<{ from: string; to: string }>
): MediaMetadata {
  // Create a map for quick lookup
  const renameMap = new Map<string, string>();
  renameMappings.forEach(({ from, to }) => {
    const fromPosix = Path.posix(from);
    const toPosix = Path.posix(to);
    renameMap.set(fromPosix, toPosix);
  });

  // Update files array
  const updatedFiles = mediaMetadata.files?.map(file => {
    const normalizedFile = Path.posix(file);
    return renameMap.get(normalizedFile) ?? file;
  });

  // Update mediaFiles array
  const updatedMediaFiles = mediaMetadata.mediaFiles?.map(mediaFile => {
    const normalizedPath = Path.posix(mediaFile.absolutePath);
    const newPath = renameMap.get(normalizedPath);
    if (newPath) {
      return {
        ...mediaFile,
        absolutePath: newPath
      };
    }
    return mediaFile;
  });

  // Update subtitle and audio file paths in mediaFiles
  const fullyUpdatedMediaFiles = updatedMediaFiles?.map(mediaFile => {
    if (mediaFile.subtitleFilePaths || mediaFile.audioFilePaths) {
      const updatedSubtitlePaths = mediaFile.subtitleFilePaths?.map(path => {
        const normalizedPath = Path.posix(path);
        return renameMap.get(normalizedPath) ?? path;
      });
      
      const updatedAudioPaths = mediaFile.audioFilePaths?.map(path => {
        const normalizedPath = Path.posix(path);
        return renameMap.get(normalizedPath) ?? path;
      });

      return {
        ...mediaFile,
        subtitleFilePaths: updatedSubtitlePaths,
        audioFilePaths: updatedAudioPaths
      };
    }
    return mediaFile;
  });

  return {
    ...mediaMetadata,
    files: updatedFiles,
    mediaFiles: fullyUpdatedMediaFiles
  };
}

export const createRenameFilesInBatchTool = (clientId: string) => ({
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

    const validationResult = await validateBatchRenameOperations(files, folderPath);

    logger.info({
      totalFiles: files.length,
      validatedRenames: validationResult.validatedRenames?.length || 0,
      validationErrors: validationResult.errors?.length || 0
    }, '[tool][renameFilesInBatch] Validation complete');

    // If there are validation errors, return them
    if (!validationResult.isValid) {
      logger.error({
        validationErrors: validationResult.errors,
        totalErrors: validationResult.errors?.length || 0
      }, '[tool][renameFilesInBatch] Validation failed');
      return { error: `Error Reason: Validation failed:\n${validationResult.errors?.join('\n') || 'Unknown validation error'}` };
    }

    const validatedRenames = validationResult.validatedRenames || [];
    if (validatedRenames.length === 0) {
      logger.warn('[tool][renameFilesInBatch] No valid rename operations');
      return { error: `Error Reason: No valid files to rename` };
    }

    // 5. Ask for user confirmation
    const getFilename = (path: string) => {
      const pathInPosix = Path.posix(path);
      const parts = pathInPosix.split('/').filter(p => p);
      return parts[parts.length - 1] || pathInPosix;
    };
    
    try {

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

    // 6. Perform rename operations on filesystem
    logger.info({
      validatedCount: validatedRenames.length,
      clientId
    }, '[tool][renameFilesInBatch] Starting batch rename execution');

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

    // 7. Update media metadata with new file paths and broadcast
    
    if (successfulRenames.length > 0) {
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

