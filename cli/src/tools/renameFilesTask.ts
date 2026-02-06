import { z } from 'zod/v3';
import { Path } from '@core/path';
import pino from 'pino';
import {
  beginRenameFilesTask,
  addRenameFileToTask,
  endRenameFilesTask as endRenameFilesTaskCore,
  getTask,
} from './renameFilesTool';
import { validateBatchRenameOperations, executeBatchRenameOperations, updateMediaMetadataAndBroadcast } from '../utils/renameFileUtils';
import { askForRenameFilesConfirmation } from '../events/askForRenameFilesConfirmation';
import { metadataCacheFilePath } from '../route/mediaMetadata/utils';
import type { MediaMetadata } from '@core/types';
import { AskForRenameFilesConfirmation } from '@core/event-types';
import { acknowledge } from '../utils/socketIO';
import { getLocalizedToolDescription } from '@/i18n/helpers';

const logger = pino();


export const createBeginRenameFilesTaskTool = async (clientId: string, abortSignal?: AbortSignal) => {
  // Use i18n to get localized tool description based on global user's language preference
  const description = await getLocalizedToolDescription('begin-rename-task');

  return {
    description: description,
    toolName: 'beginRenameFilesTask',
    inputSchema: z.object({
      mediaFolderPath: z.string().describe("The absolute path of the media folder, it can be POSIX format or Windows format"),
    }),
    execute: async ({ mediaFolderPath }: { mediaFolderPath: string }) => {
    // TODO: Implement abort handling - check abortSignal and cancel ongoing operations
    if (abortSignal?.aborted) {
      throw new Error('Request was aborted');
    }
    logger.info({
      mediaFolderPath,
      clientId
    }, '[tool][beginRenameFilesTask] Starting new rename task');

    const folderPathInPosix = Path.posix(mediaFolderPath);

    // Verify that the media folder has metadata
    const metadataFilePath = metadataCacheFilePath(folderPathInPosix);
    const metadataExists = await Bun.file(metadataFilePath).exists();

    if (!metadataExists) {
      logger.warn({
        folderPath: folderPathInPosix
      }, '[tool][beginRenameFilesTask] Media metadata not found');
      return { error: `Error Reason: folderPath "${folderPathInPosix}" is not opened in SMM` };
    }

    try {
      const taskId = beginRenameFilesTask(folderPathInPosix);
      
      logger.info({
        taskId,
        mediaFolderPath: folderPathInPosix,
        clientId
      }, '[tool][beginRenameFilesTask] Task created successfully');

      return {
        taskId,
        error: undefined
      };
    } catch (error) {
      logger.error({
        mediaFolderPath: folderPathInPosix,
        error: error instanceof Error ? error.message : String(error),
        clientId
      }, '[tool][beginRenameFilesTask] Failed to create task');
      return { error: `Error Reason: Failed to create task: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  },
};
};

export const createAddRenameFileToTaskTool = async (clientId: string, abortSignal?: AbortSignal) => {
  // Use i18n to get localized tool description based on global user's language preference
  const description = await getLocalizedToolDescription('add-rename-file-to-task');

  return {
    description: description,
    toolName: 'addRenameFileToTask',
    inputSchema: z.object({
      taskId: z.string().describe("The task ID returned from beginRenameFilesTask"),
      from: z.string().describe("The current absolute path of the file to rename, it can be POSIX format or Windows format. ONLY accept video file."),
      to: z.string().describe("The new absolute path for the file, it can be POSIX format or Windows format"),
    }),
    execute: async ({ taskId, from, to }: {
      taskId: string;
      from: string;
      to: string;
    }) => {
    // TODO: Implement abort handling - check abortSignal and cancel ongoing operations
    if (abortSignal?.aborted) {
      throw new Error('Request was aborted');
    }
    logger.info({
      taskId,
      from,
      to,
      clientId
    }, '[tool][addRenameFileToTask] Adding file to task');

    try {
      const fromPathInPosix = Path.posix(from);
      const toPathInPosix = Path.posix(to);

      addRenameFileToTask(taskId, fromPathInPosix, toPathInPosix);

      logger.info({
        taskId,
        from: fromPathInPosix,
        to: toPathInPosix,
        clientId
      }, '[tool][addRenameFileToTask] File added to task successfully');

      return {
        error: undefined
      };
    } catch (error) {
      logger.error({
        taskId,
        from,
        to,
        error: error instanceof Error ? error.message : String(error),
        clientId
      }, '[tool][addRenameFileToTask] Failed to add file to task');
      return { error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  },
};
};

export const createEndRenameFilesTaskTool = async (clientId: string, abortSignal?: AbortSignal) => {
  // Use i18n to get localized tool description based on global user's language preference
  const description = await getLocalizedToolDescription('end-rename-task');

  return {
    description: description,
    toolName: 'endRenameFilesTask',
    inputSchema: z.object({
      taskId: z.string().describe("The task ID returned from beginRenameFilesTask"),
    }),
    execute: async ({ taskId }: { taskId: string }) => {
    // TODO: Implement abort handling - check abortSignal and cancel ongoing operations
    if (abortSignal?.aborted) {
      throw new Error('Request was aborted');
    }
    logger.info({
      taskId,
      clientId
    }, '[tool][endRenameFilesTask] Ending rename task');

    // We need to access the task from the cache
    // Since the cache is private in renameFilesTool.ts, we need to modify that file
    // For now, let's check if we can get the task another way
    // Actually, we should modify renameFilesTool.ts to export a getTask function
    
    // For now, let's call endRenameFilesTaskCore which will throw if task doesn't exist
    // But we need the task data first to validate and execute
    // Let's modify renameFilesTool.ts to export getTask
    
    try {
      const task = getTask(taskId);
      
      if (!task) {
        logger.error({
          taskId,
          clientId
        }, '[tool][endRenameFilesTask] Task not found');
        return { error: `Error Reason: Task with id "${taskId}" not found` };
      }

      const folderPathInPosix = task.mediaFolderPath;
      const files = task.files;

      if (files.length === 0) {
        logger.warn({
          taskId,
          clientId
        }, '[tool][endRenameFilesTask] No files in task');
        return { error: `Error Reason: No files to rename in task` };
      }


      logger.info({
        taskId,
        folderPath: folderPathInPosix,
        fileCount: files.length,
        clientId
      }, '[tool][endRenameFilesTask] Starting validation');

      // 1. Read media metadata
      const metadataFilePath = metadataCacheFilePath(folderPathInPosix);
      const metadataExists = await Bun.file(metadataFilePath).exists();

      if (!metadataExists) {
        logger.warn({
          folderPath: folderPathInPosix
        }, '[tool][endRenameFilesTask] Media metadata not found');
        return { error: `Error Reason: folderPath "${folderPathInPosix}" is not opened in SMM` };
      }

      let mediaMetadata: MediaMetadata;
      try {
        mediaMetadata = await Bun.file(metadataFilePath).json() as MediaMetadata;
      } catch (error) {
        logger.error({
          folderPath: folderPathInPosix,
          error: error instanceof Error ? error.message : String(error)
        }, '[tool][endRenameFilesTask] Failed to read media metadata');
        return { error: `Error Reason: Failed to read media metadata: ${error instanceof Error ? error.message : 'Unknown error'}` };
      }

      // 2. Validate all rename operations
      const validationResult = await validateBatchRenameOperations(files, folderPathInPosix);

      logger.info({
        taskId,
        totalFiles: files.length,
        validatedRenames: validationResult.validatedRenames?.length || 0,
        validationErrors: validationResult.errors?.length || 0,
        clientId
      }, '[tool][endRenameFilesTask] Validation complete');

      if (!validationResult.isValid) {
        logger.error({
          taskId,
          validationErrors: validationResult.errors,
          totalErrors: validationResult.errors?.length || 0,
          clientId
        }, '[tool][endRenameFilesTask] Validation failed');
        return { error: `Error Reason: Validation failed:\n${validationResult.errors?.join('\n') || 'Unknown validation error'}` };
      }

      const validatedRenames = validationResult.validatedRenames || [];
      if (validatedRenames.length === 0) {
        logger.warn({
          taskId,
          clientId
        }, '[tool][endRenameFilesTask] No valid rename operations');
        return { error: `Error Reason: No valid files to rename` };
      }

      // TODO: Check abortSignal before asking for confirmation
      if (abortSignal?.aborted) {
        throw new Error('Request was aborted');
      }

      // 3. Ask for user confirmation
      logger.info("[tool][endRenameFilesTask] Sending askForRenameFilesConfirmation event");
      // TODO: Check abortSignal during acknowledgement wait
      const resp = await acknowledge(
        {
          event: AskForRenameFilesConfirmation.endEvent,
          data: {
            mediaFolderPath: folderPathInPosix,
          }
        },
      );

      logger.info({
        response: resp,
      }, '[tool][endRenameFilesTask] User confirmation received');
      if(resp.confirmed === false ) {
        return { error: `Error Reason: User cancelled the operation` };
      }

      // TODO: Check abortSignal before executing rename operations
      if (abortSignal?.aborted) {
        throw new Error('Request was aborted');
      }

      // 4. Execute rename operations
      logger.info({
        taskId,
        validatedCount: validatedRenames.length,
        clientId
      }, '[tool][endRenameFilesTask] Starting batch rename execution');

      // TODO: Check abortSignal during batch rename execution
      const renameResult = await executeBatchRenameOperations(validatedRenames, {
        dryRun: false,
        clientId,
        logPrefix: '[tool][endRenameFilesTask]',
      });

      if (!renameResult.success) {
        logger.error({
          taskId,
          totalFiles: files.length,
          failedCount: renameResult.errors?.length || 0,
          successfulCount: renameResult.successfulRenames?.length || 0,
          clientId
        }, '[tool][endRenameFilesTask] Batch rename execution failed');
        return { error: `Error Reason: Some rename operations failed:\n${renameResult.errors?.join('\n') || 'Unknown error'}` };
      }

      const successfulRenames = renameResult.successfulRenames || [];
      if (successfulRenames.length === 0) {
        logger.warn({
          taskId,
          clientId
        }, '[tool][endRenameFilesTask] No files were successfully renamed');
        return { error: `Error Reason: No files were successfully renamed` };
      }

      // TODO: Check abortSignal before updating metadata
      if (abortSignal?.aborted) {
        throw new Error('Request was aborted');
      }

      // 5. Update media metadata
      if (successfulRenames.length > 0) {
        // TODO: Check abortSignal during metadata update
        const metadataUpdateResult = await updateMediaMetadataAndBroadcast(
          folderPathInPosix,
          successfulRenames,
          {
            dryRun: false,
            clientId,
            logPrefix: '[tool][endRenameFilesTask]',
          }
        );

        if (!metadataUpdateResult.success) {
          logger.error({
            taskId,
            folderPath: folderPathInPosix,
            error: metadataUpdateResult.error
          }, '[tool][endRenameFilesTask] Failed to update media metadata');
          return { error: `Error Reason: Failed to write media metadata: ${metadataUpdateResult.error}` };
        }
      }

      // 6. Clean up the task
      endRenameFilesTaskCore(taskId);

      logger.info({
        taskId,
        folderPath: folderPathInPosix,
        totalRenamed: successfulRenames.length,
        clientId
      }, '[tool][endRenameFilesTask] Task completed successfully');

      return {
        error: undefined
      };
    } catch (error) {
      const resp = { error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}` };
      logger.info({
        taskId,
        clientId,
        response: resp,
      }, '[tool][endRenameFilesTask] End task with unxpected error');
      return resp;
    } finally {
      logger.info({
        taskId,
        clientId
      }, '[tool][endRenameFilesTask] ended');
    }
  },
};
};

