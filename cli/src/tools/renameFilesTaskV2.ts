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

const logger = pino()

export const createBeginRenameFilesTaskV2Tool = (clientId: string, abortSignal?: AbortSignal) => ({
  description: `Begin a rename files task V2 for a media folder.
This tool creates a new plan that is saved to disk. You can then add rename operations with addRenameFileToTaskV2 and finish with endRenameFilesTaskV2.
The user will review the plan in the UI and confirm or cancel; the chat is not blocked.
Use this instead of beginRenameFilesTask when you want a plan-then-confirm flow like recognition.
Call this first, then addRenameFileToTaskV2 for each file, then endRenameFilesTaskV2.
Returns a task ID to use with addRenameFileToTaskV2 and endRenameFilesTaskV2.`,
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
})

export const createAddRenameFileToTaskV2Tool = (clientId: string, abortSignal?: AbortSignal) => ({
  description: `Add a file rename (from/to) to an existing rename task V2.
Call this after beginRenameFilesTaskV2 for each file to rename.
You DO NOT need to add thumbnail, subtitle, or nfo files; they are renamed when the main video is renamed.`,
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
})

export const createEndRenameFilesTaskV2Tool = (clientId: string, abortSignal?: AbortSignal) => ({
  description: `End a rename task V2 and notify the UI that the plan is ready for review.
The plan is persisted and the user will see a confirm/cancel prompt in the UI. The chat is not blocked.
Call this after adding all files with addRenameFileToTaskV2. The task must have at least one file.`,
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
})
