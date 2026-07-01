import { Path } from '@core/path'
import { logger } from '../../lib/logger'
import {
  BEGIN_RECOGNIZE_TASK,
  ADD_RECOGNIZED_MEDIA_FILE,
  END_RECOGNIZE_TASK,
  BEGIN_RECOGNIZE_TASK_DESCRIPTION,
  ADD_RECOGNIZED_MEDIA_FILE_DESCRIPTION,
  END_RECOGNIZE_TASK_DESCRIPTION,
  beginRecognizeTaskInputSchema,
  addRecognizedMediaFileInputSchema,
  endRecognizeTaskInputSchema,
} from '@core/types/ai-tools/recognizeMediaFileTask'
import { formatToolError, toolOk } from '@core/ai-tool/toolResult'
import {
  beginRecognizeTask,
  addRecognizedMediaFile,
  endRecognizeTask as endRecognizeTaskCore,
  getTask,
} from './recognizeMediaFilesTool'
import type { RecognizedFile } from '@core/types/RecognizeMediaFilePlan'

export const createBeginRecognizeTaskTool = (
  clientId: string,
  abortSignal?: AbortSignal,
) => ({
  description: BEGIN_RECOGNIZE_TASK_DESCRIPTION,
  toolName: BEGIN_RECOGNIZE_TASK,
  inputSchema: beginRecognizeTaskInputSchema,
  execute: async ({ mediaFolderPath }: { mediaFolderPath: string }) => {
    if (abortSignal?.aborted) {
      throw new Error('Request was aborted')
    }
    logger.info(
      { mediaFolderPath, clientId },
      `[tool][${BEGIN_RECOGNIZE_TASK}] Starting new recognition task`,
    )

    const folderPathInPosix = Path.posix(mediaFolderPath)

    try {
      const taskId = await beginRecognizeTask(folderPathInPosix)
      logger.info(
        { taskId, mediaFolderPath: folderPathInPosix, clientId },
        `[tool][${BEGIN_RECOGNIZE_TASK}] Task created successfully`,
      )
      return toolOk({ taskId })
    } catch (error) {
      logger.error(
        {
          mediaFolderPath: folderPathInPosix,
          error: error instanceof Error ? error.message : String(error),
          clientId,
        },
        `[tool][${BEGIN_RECOGNIZE_TASK}] Failed to create task`,
      )
      return formatToolError(error)
    }
  },
})

export const createAddRecognizedMediaFileTool = (
  clientId: string,
  abortSignal?: AbortSignal,
) => ({
  description: ADD_RECOGNIZED_MEDIA_FILE_DESCRIPTION,
  toolName: ADD_RECOGNIZED_MEDIA_FILE,
  inputSchema: addRecognizedMediaFileInputSchema,
  execute: async ({
    taskId,
    season,
    episode,
    path: filePath,
  }: {
    taskId: string
    season: number
    episode: number
    path: string
  }) => {
    if (abortSignal?.aborted) {
      throw new Error('Request was aborted')
    }
    logger.info(
      { taskId, season, episode, path: filePath, clientId },
      `[tool][${ADD_RECOGNIZED_MEDIA_FILE}] Adding file to task`,
    )

    try {
      const recognizedFile: RecognizedFile = {
        season,
        episode,
        path: Path.posix(filePath),
      }

      await addRecognizedMediaFile(taskId, recognizedFile)

      logger.info(
        { taskId, season, episode, path: filePath, clientId },
        `[tool][${ADD_RECOGNIZED_MEDIA_FILE}] File added to task successfully`,
      )

      return toolOk({})
    } catch (error) {
      logger.error(
        {
          taskId,
          season,
          episode,
          path: filePath,
          error: error instanceof Error ? error.message : String(error),
          clientId,
        },
        `[tool][${ADD_RECOGNIZED_MEDIA_FILE}] Failed to add file to task`,
      )
      return formatToolError(error)
    }
  },
})

export const createEndRecognizeTaskTool = (
  clientId: string,
  abortSignal?: AbortSignal,
) => ({
  description: END_RECOGNIZE_TASK_DESCRIPTION,
  toolName: END_RECOGNIZE_TASK,
  inputSchema: endRecognizeTaskInputSchema,
  execute: async ({ taskId }: { taskId: string }) => {
    if (abortSignal?.aborted) {
      throw new Error('Request was aborted')
    }
    logger.info(
      { taskId, clientId },
      `[tool][${END_RECOGNIZE_TASK}] Ending recognition task`,
    )

    try {
      const task = await getTask(taskId)

      if (!task) {
        logger.error(
          { taskId, clientId },
          `[tool][${END_RECOGNIZE_TASK}] Task not found`,
        )
        return formatToolError(`Task with id "${taskId}" not found`)
      }

      if (task.files.length === 0) {
        logger.warn(
          { taskId, clientId },
          `[tool][${END_RECOGNIZE_TASK}] No files in task`,
        )
        return formatToolError('No recognized files in task')
      }

      await endRecognizeTaskCore(taskId)

      logger.info(
        { taskId, folderPath: task.mediaFolderPath, fileCount: task.files.length, clientId },
        `[tool][${END_RECOGNIZE_TASK}] Task completed successfully`,
      )

      return toolOk({})
    } catch (error) {
      return formatToolError(error)
    }
  },
})
