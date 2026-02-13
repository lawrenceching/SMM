import { z } from 'zod/v3'
import { Path } from '@core/path'
import pino from 'pino'
import {
  beginRenameFilesTaskV2,
  addRenameFileToTaskV2,
  endRenameFilesTaskV2,
  getRenameTask,
} from './renameFilesToolV2'
import { metadataCacheFilePath } from '../route/mediaMetadata/utils'
import { getLocalizedToolDescription } from '@/i18n/helpers'

const logger = pino()

export const createBeginRenameFilesTaskV2Tool = async (clientId: string, abortSignal?: AbortSignal) => {
  const description = await getLocalizedToolDescription('begin-rename-task-v2');

  return {
  description: description,
  toolName: 'beginRenameFilesTaskV2',
  inputSchema: z.object({
    mediaFolderPath: z
      .string()
      .describe(
        'The absolute path of the media folder, it can be POSIX format or Windows format'
      ),
  }),
  execute: async ({ mediaFolderPath }: { mediaFolderPath: string }) => {
    if (abortSignal?.aborted) {
      throw new Error('Request was aborted')
    }
    logger.info(
      { mediaFolderPath, clientId },
      '[tool][beginRenameFilesTaskV2] Starting new rename task V2'
    )

    const folderPathInPosix = Path.posix(mediaFolderPath)

    const metadataFilePath = metadataCacheFilePath(folderPathInPosix)
    const metadataExists = await Bun.file(metadataFilePath).exists()

    if (!metadataExists) {
      logger.warn({ folderPath: folderPathInPosix }, '[tool][beginRenameFilesTaskV2] Media metadata not found')
      return { error: `Error Reason: folderPath "${folderPathInPosix}" is not opened in SMM` }
    }

    try {
      const taskId = await beginRenameFilesTaskV2(folderPathInPosix)

      logger.info(
        { taskId, mediaFolderPath: folderPathInPosix, clientId },
        '[tool][beginRenameFilesTaskV2] Task created successfully'
      )

      return { taskId, error: undefined }
    } catch (error) {
      logger.error(
        {
          mediaFolderPath: folderPathInPosix,
          error: error instanceof Error ? error.message : String(error),
          clientId,
        },
        '[tool][beginRenameFilesTaskV2] Failed to create task'
      )
      return {
        error: `Error Reason: Failed to create task: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  },
  };
};

export const createAddRenameFileToTaskV2Tool = async (clientId: string, abortSignal?: AbortSignal) => {
  const description = await getLocalizedToolDescription('add-rename-file-to-task-v2');

  return {
  description: description,
  toolName: 'addRenameFileToTaskV2',
  inputSchema: z.object({
    taskId: z.string().describe('The task ID from beginRenameFilesTaskV2'),
    from: z
      .string()
      .describe(
        'Current absolute path of the video file to rename (POSIX or Windows format)'
      ),
    to: z
      .string()
      .describe('New absolute path for the file (POSIX or Windows format)'),
  }),
  execute: async ({
    taskId,
    from,
    to,
  }: {
    taskId: string
    from: string
    to: string
  }) => {
    if (abortSignal?.aborted) {
      throw new Error('Request was aborted')
    }
    logger.info(
      { taskId, from, to, clientId },
      '[tool][addRenameFileToTaskV2] Adding file to task'
    )

    try {
      await addRenameFileToTaskV2(taskId, from, to)

      logger.info(
        { taskId, from, to, clientId },
        '[tool][addRenameFileToTaskV2] File added successfully'
      )

      return { error: undefined }
    } catch (error) {
      logger.error(
        {
          taskId,
          from,
          to,
          error: error instanceof Error ? error.message : String(error),
          clientId,
        },
        '[tool][addRenameFileToTaskV2] Failed to add file'
      )
      return {
        error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  },
  };
};

export const createEndRenameFilesTaskV2Tool = async (clientId: string, abortSignal?: AbortSignal) => {
  const description = await getLocalizedToolDescription('end-rename-task-v2');

  return {
  description: description,
  toolName: 'endRenameFilesTaskV2',
  inputSchema: z.object({
    taskId: z.string().describe('The task ID from beginRenameFilesTaskV2'),
  }),
  execute: async ({ taskId }: { taskId: string }) => {
    if (abortSignal?.aborted) {
      throw new Error('Request was aborted')
    }
    logger.info({ taskId, clientId }, '[tool][endRenameFilesTaskV2] Ending rename task V2')

    try {
      const task = await getRenameTask(taskId)

      if (!task) {
        logger.error({ taskId, clientId }, '[tool][endRenameFilesTaskV2] Task not found')
        return { error: `Error Reason: Task with id "${taskId}" not found` }
      }

      if (task.files.length === 0) {
        logger.warn({ taskId, clientId }, '[tool][endRenameFilesTaskV2] No files in task')
        return { error: `Error Reason: No rename entries in task` }
      }

      await endRenameFilesTaskV2(taskId)

      logger.info(
        { taskId, fileCount: task.files.length, clientId },
        '[tool][endRenameFilesTaskV2] Plan ready, UI notified'
      )

      return { error: undefined }
    } catch (error) {
      logger.error(
        {
          taskId,
          error: error instanceof Error ? error.message : String(error),
          clientId,
        },
        '[tool][endRenameFilesTaskV2] End task error'
      )
      return {
        error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  },
  };
};
