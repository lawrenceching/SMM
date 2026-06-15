import pino from 'pino'
import { Path } from '@core/path'
import {
  BEGIN_RENAME_FILES_TASK,
  ADD_RENAME_FILE_TO_TASK,
  END_RENAME_FILES_TASK,
  BEGIN_RENAME_FILES_TASK_DESCRIPTION,
  ADD_RENAME_FILE_TO_TASK_DESCRIPTION,
  END_RENAME_FILES_TASK_DESCRIPTION,
  beginRenameFilesTaskInputSchema,
  addRenameFileToTaskInputSchema,
  endRenameFilesTaskInputSchema,
} from '@core/types/ai-tools/renameFilesTask'
import { assertMediaFolderHasMetadata } from '@core/plan/renamePlan'
import { toolError, toolOk, formatToolError } from '@core/ai-tool/toolResult'
import {
  beginRenameFilesTaskV2,
  addRenameFileToTaskV2,
  endRenameFilesTaskV2,
  getRenameTask,
} from './renameFilesToolV2'
import { metadataCacheFilePath } from '../route/mediaMetadata/utils'

const logger = pino()

export const createBeginRenameFilesTaskTool = (
  clientId: string,
  abortSignal?: AbortSignal,
) => ({
  description: BEGIN_RENAME_FILES_TASK_DESCRIPTION,
  toolName: BEGIN_RENAME_FILES_TASK,
  inputSchema: beginRenameFilesTaskInputSchema,
  execute: async ({ mediaFolderPath }: { mediaFolderPath: string }) => {
    if (abortSignal?.aborted) {
      throw new Error('Request was aborted')
    }
    logger.info(
      { mediaFolderPath, clientId },
      `[tool][${BEGIN_RENAME_FILES_TASK}] Starting new rename task`,
    )

    const folderPathInPosix = Path.posix(mediaFolderPath)
    const metadataFilePath = metadataCacheFilePath(folderPathInPosix)
    const metadataExists = await Bun.file(metadataFilePath).exists()

    const metadataError = assertMediaFolderHasMetadata(metadataExists, folderPathInPosix)
    if (metadataError) {
      logger.warn(
        { folderPath: folderPathInPosix },
        `[tool][${BEGIN_RENAME_FILES_TASK}] Media metadata not found`,
      )
      return toolError(metadataError.replace(/^Error Reason: /, ''))
    }

    try {
      const taskId = await beginRenameFilesTaskV2(folderPathInPosix)
      logger.info(
        { taskId, mediaFolderPath: folderPathInPosix, clientId },
        `[tool][${BEGIN_RENAME_FILES_TASK}] Task created successfully`,
      )
      return toolOk({ taskId })
    } catch (error) {
      logger.error(
        {
          mediaFolderPath: folderPathInPosix,
          error: error instanceof Error ? error.message : String(error),
          clientId,
        },
        `[tool][${BEGIN_RENAME_FILES_TASK}] Failed to create task`,
      )
      return formatToolError(error)
    }
  },
})

export const createAddRenameFileToTaskTool = (
  clientId: string,
  abortSignal?: AbortSignal,
) => ({
  description: ADD_RENAME_FILE_TO_TASK_DESCRIPTION,
  toolName: ADD_RENAME_FILE_TO_TASK,
  inputSchema: addRenameFileToTaskInputSchema,
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
      `[tool][${ADD_RENAME_FILE_TO_TASK}] Adding file to task`,
    )

    try {
      await addRenameFileToTaskV2(taskId, from, to)
      logger.info(
        { taskId, from, to, clientId },
        `[tool][${ADD_RENAME_FILE_TO_TASK}] File added successfully`,
      )
      return toolOk({})
    } catch (error) {
      logger.error(
        {
          taskId,
          from,
          to,
          error: error instanceof Error ? error.message : String(error),
          clientId,
        },
        `[tool][${ADD_RENAME_FILE_TO_TASK}] Failed to add file`,
      )
      return formatToolError(error)
    }
  },
})

export const createEndRenameFilesTaskTool = (
  clientId: string,
  abortSignal?: AbortSignal,
) => ({
  description: END_RENAME_FILES_TASK_DESCRIPTION,
  toolName: END_RENAME_FILES_TASK,
  inputSchema: endRenameFilesTaskInputSchema,
  execute: async ({ taskId }: { taskId: string }) => {
    if (abortSignal?.aborted) {
      throw new Error('Request was aborted')
    }
    logger.info(
      { taskId, clientId },
      `[tool][${END_RENAME_FILES_TASK}] Ending rename task`,
    )

    try {
      const task = await getRenameTask(taskId)

      if (!task) {
        logger.error(
          { taskId, clientId },
          `[tool][${END_RENAME_FILES_TASK}] Task not found`,
        )
        return toolError(`Task with id "${taskId}" not found`)
      }

      if (task.files.length === 0) {
        logger.warn(
          { taskId, clientId },
          `[tool][${END_RENAME_FILES_TASK}] No files in task`,
        )
        return toolError('No rename entries in task')
      }

      await endRenameFilesTaskV2(taskId)

      logger.info(
        { taskId, fileCount: task.files.length, clientId },
        `[tool][${END_RENAME_FILES_TASK}] Plan ready, UI notified`,
      )

      return toolOk({})
    } catch (error) {
      logger.error(
        {
          taskId,
          error: error instanceof Error ? error.message : String(error),
          clientId,
        },
        `[tool][${END_RENAME_FILES_TASK}] End task error`,
      )
      return formatToolError(error)
    }
  },
})

/** @deprecated Use createBeginRenameFilesTaskTool */
export const createBeginRenameFilesTaskV2Tool = createBeginRenameFilesTaskTool
/** @deprecated Use createAddRenameFileToTaskTool */
export const createAddRenameFileToTaskV2Tool = createAddRenameFileToTaskTool
/** @deprecated Use createEndRenameFilesTaskTool */
export const createEndRenameFilesTaskV2Tool = createEndRenameFilesTaskTool
