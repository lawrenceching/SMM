import { z } from 'zod/v3';
import { Path } from '@core/path';
import pino from 'pino';
import {
  beginRecognizeTask,
  addRecognizedMediaFile,
  endRecognizeTask as endRecognizeTaskCore,
  getTask,
} from './recognizeMediaFilesTool';
import type { RecognizedFile } from '@core/types/RecognizeMediaFilePlan';
import { getLocalizedToolDescription } from '@/i18n/helpers';

const logger = pino();

export const createBeginRecognizeTaskTool = async (clientId: string, abortSignal?: AbortSignal) => {
  const description = await getLocalizedToolDescription('begin-recognize-task');

  return {
  description: description,
  toolName: 'beginRecognizeTask',
  inputSchema: z.object({
    mediaFolderPath: z.string().describe("The absolute path of the media folder, it can be POSIX format or Windows format"),
  }),
  execute: async ({ mediaFolderPath }: { mediaFolderPath: string }) => {
    if (abortSignal?.aborted) {
      throw new Error('Request was aborted');
    }
    logger.info({
      mediaFolderPath,
      clientId
    }, '[tool][beginRecognizeTask] Starting new recognition task');

    const folderPathInPosix = Path.posix(mediaFolderPath);

    try {
      const taskId = await beginRecognizeTask(folderPathInPosix);
      
      logger.info({
        taskId,
        mediaFolderPath: folderPathInPosix,
        clientId
      }, '[tool][beginRecognizeTask] Task created successfully');

      return {
        taskId,
        error: undefined
      };
    } catch (error) {
      logger.error({
        mediaFolderPath: folderPathInPosix,
        error: error instanceof Error ? error.message : String(error),
        clientId
      }, '[tool][beginRecognizeTask] Failed to create task');
      return { error: `Error Reason: Failed to create task: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  },
  };
};

export const createAddRecognizedMediaFileTool = async (clientId: string, abortSignal?: AbortSignal) => {
  const description = await getLocalizedToolDescription('add-recognized-media-file');

  return {
  description: description,
  toolName: 'addRecognizedMediaFile',
  inputSchema: z.object({
    taskId: z.string().describe("The task ID returned from beginRecognizeTask"),
    season: z.number().describe("The season number of the episode"),
    episode: z.number().describe("The episode number"),
    path: z.string().describe("The absolute path of the media file, it can be POSIX format or Windows format"),
  }),
  execute: async ({ taskId, season, episode, path: filePath }: {
    taskId: string;
    season: number;
    episode: number;
    path: string;
  }) => {
    if (abortSignal?.aborted) {
      throw new Error('Request was aborted');
    }
    logger.info({
      taskId,
      season,
      episode,
      path: filePath,
      clientId
    }, '[tool][addRecognizedMediaFile] Adding file to task');

    try {
      const filePathInPosix = Path.posix(filePath);

      const recognizedFile: RecognizedFile = {
        season,
        episode,
        path: filePathInPosix,
      };

      await addRecognizedMediaFile(taskId, recognizedFile);

      logger.info({
        taskId,
        season,
        episode,
        path: filePathInPosix,
        clientId
      }, '[tool][addRecognizedMediaFile] File added to task successfully');

      return {
        error: undefined
      };
    } catch (error) {
      logger.error({
        taskId,
        season,
        episode,
        path: filePath,
        error: error instanceof Error ? error.message : String(error),
        clientId
      }, '[tool][addRecognizedMediaFile] Failed to add file to task');
      return { error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  },
  };
};

export const createEndRecognizeTaskTool = async (clientId: string, abortSignal?: AbortSignal) => {
  const description = await getLocalizedToolDescription('end-recognize-task');

  return {
  description: description,
  toolName: 'endRecognizeTask',
  inputSchema: z.object({
    taskId: z.string().describe("The task ID returned from beginRecognizeTask"),
  }),
  execute: async ({ taskId }: { taskId: string }) => {
    if (abortSignal?.aborted) {
      throw new Error('Request was aborted');
    }
    logger.info({
      taskId,
      clientId
    }, '[tool][endRecognizeTask] Ending recognition task');

    try {
      const task = await getTask(taskId);
      
      if (!task) {
        logger.error({
          taskId,
          clientId
        }, '[tool][endRecognizeTask] Task not found');
        return { error: `Error Reason: Task with id "${taskId}" not found` };
      }

      if (task.files.length === 0) {
        logger.warn({
          taskId,
          clientId
        }, '[tool][endRecognizeTask] No files in task');
        return { error: `Error Reason: No recognized files in task` };
      }

      logger.info({
        taskId,
        folderPath: task.mediaFolderPath,
        fileCount: task.files.length,
        clientId
      }, '[tool][endRecognizeTask] Notifying UI that plan is ready');

      await endRecognizeTaskCore(taskId);

      logger.info({
        taskId,
        folderPath: task.mediaFolderPath,
        fileCount: task.files.length,
        clientId
      }, '[tool][endRecognizeTask] Task completed successfully');

      return {
        error: undefined
      };
    } catch (error) {
      const resp = { error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}` };
      logger.info({
        taskId,
        clientId,
        response: resp,
      }, '[tool][endRecognizeTask] End task with unexpected error');
      return resp;
    } finally {
      logger.info({
        taskId,
        clientId
      }, '[tool][endRecognizeTask] ended');
    }
  },
  };
};
