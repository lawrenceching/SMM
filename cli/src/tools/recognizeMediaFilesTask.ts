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

const logger = pino();

export const createBeginRecognizeTaskTool = (clientId: string, abortSignal?: AbortSignal) => ({
  description: `Begin a media file recognition task for a media folder.
This tool creates a new task that allows you to collect multiple recognized media files before presenting the complete plan to the user for review.
You should call this tool first, then use addRecognizedMediaFile to add recognized files, and finally call endRecognizeTask to notify the UI that the plan is ready.

Example: Begin a recognition task for folder "/path/to/media/folder".
This tool returns a task ID that you must use with addRecognizedMediaFile and endRecognizeTask.
`,
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
});

export const createAddRecognizedMediaFileTool = (clientId: string, abortSignal?: AbortSignal) => ({
  description: `Add a recognized media file to an existing recognition task.
This tool adds a single recognized file (with season, episode, and path) to a task that was created with beginRecognizeTask.
You can call this tool multiple times to add multiple files to the same task.

Example: Add a recognized file to task "task-id-123" with season 1, episode 5, and path "/path/to/file.mp4".
`,
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
});

export const createEndRecognizeTaskTool = (clientId: string, abortSignal?: AbortSignal) => ({
  description: `End a recognition task and notify the UI that the plan is ready for review.
This tool reads the final recognition plan and broadcasts a Socket.IO event to notify the UI.

Example: End task "task-id-123" to notify the UI that the recognition plan is ready.
`,
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
});
