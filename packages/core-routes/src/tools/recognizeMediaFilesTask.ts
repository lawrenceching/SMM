import { Path } from "@smm/core/path";
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
} from "@smm/core/types/ai-tools/recognizeMediaFileTask";
import { formatToolError, toolOk } from "@smm/core/ai-tool/toolResult";
import {
  RecognizeMediaFilePlanReady,
  type RecognizeMediaFilePlanReadyRequestData,
} from "@smm/core/event-types";
import type { RecognizedFile } from "@smm/core/types/RecognizeMediaFilePlan";
import type { CoreRoutesLogger } from "../types.ts";
import { defaultAcknowledge } from "./acknowledge.ts";
import {
  appendRecognizedFile,
  beginRecognizePlan,
  planFilePath,
  readRecognizePlan,
} from "./plans.ts";
import type { ChatFs } from "../chatTypes.ts";

function makeLogger(logger: CoreRoutesLogger | undefined) {
  return {
    info: (obj: Record<string, unknown>, msg?: string) =>
      logger?.info(obj, msg),
    warn: (obj: Record<string, unknown>, msg?: string) =>
      logger?.warn(obj, msg),
    error: (obj: Record<string, unknown>, msg?: string) =>
      logger?.error(obj, msg),
  };
}

export function buildBeginRecognizeTaskTool(
  clientId: string,
  appDataDir: string,
  fs: ChatFs,
  logger: CoreRoutesLogger | undefined,
  abortSignal?: AbortSignal,
) {
  const log = makeLogger(logger);
  return {
    description: BEGIN_RECOGNIZE_TASK_DESCRIPTION,
    toolName: BEGIN_RECOGNIZE_TASK,
    inputSchema: beginRecognizeTaskInputSchema,
    execute: async (args: unknown) => {
      if (abortSignal?.aborted) {
        throw new Error("Request was aborted");
      }
      const { mediaFolderPath } = (args ?? {}) as { mediaFolderPath?: string };
      log.info(
        { mediaFolderPath, clientId },
        `[tool][${BEGIN_RECOGNIZE_TASK}] Starting new recognition task`,
      );

      const folderPathInPosix = Path.posix(mediaFolderPath ?? "");

      try {
        const taskId = await beginRecognizePlan(
          appDataDir,
          folderPathInPosix,
          fs,
        );
        log.info(
          { taskId, mediaFolderPath: folderPathInPosix, clientId },
          `[tool][${BEGIN_RECOGNIZE_TASK}] Task created successfully`,
        );
        return toolOk({ taskId });
      } catch (error) {
        log.error(
          {
            mediaFolderPath: folderPathInPosix,
            error: error instanceof Error ? error.message : String(error),
            clientId,
          },
          `[tool][${BEGIN_RECOGNIZE_TASK}] Failed to create task`,
        );
        return formatToolError(error);
      }
    },
  };
}

export function buildAddRecognizedMediaFileTool(
  clientId: string,
  appDataDir: string,
  fs: ChatFs,
  logger: CoreRoutesLogger | undefined,
  abortSignal?: AbortSignal,
) {
  const log = makeLogger(logger);
  return {
    description: ADD_RECOGNIZED_MEDIA_FILE_DESCRIPTION,
    toolName: ADD_RECOGNIZED_MEDIA_FILE,
    inputSchema: addRecognizedMediaFileInputSchema,
    execute: async (args: unknown) => {
      if (abortSignal?.aborted) {
        throw new Error("Request was aborted");
      }
      const { taskId, season, episode, path: filePath } = (args ?? {}) as {
        taskId?: string;
        season?: number;
        episode?: number;
        path?: string;
      };
      log.info(
        { taskId, season, episode, path: filePath, clientId },
        `[tool][${ADD_RECOGNIZED_MEDIA_FILE}] Adding file to task`,
      );

      try {
        const recognizedFile: RecognizedFile = {
          season: season ?? 0,
          episode: episode ?? 0,
          path: filePath ?? "",
        };

        await appendRecognizedFile(appDataDir, taskId ?? "", recognizedFile, fs);

        log.info(
          { taskId, season, episode, path: filePath, clientId },
          `[tool][${ADD_RECOGNIZED_MEDIA_FILE}] File added to task successfully`,
        );

        return toolOk({});
      } catch (error) {
        log.error(
          {
            taskId,
            season,
            episode,
            path: filePath,
            error: error instanceof Error ? error.message : String(error),
            clientId,
          },
          `[tool][${ADD_RECOGNIZED_MEDIA_FILE}] Failed to add file to task`,
        );
        return formatToolError(error);
      }
    },
  };
}

export function buildEndRecognizeTaskTool(
  clientId: string,
  appDataDir: string,
  fs: ChatFs,
  acknowledge:
    | ((message: unknown, timeoutMs?: number) => Promise<unknown>)
    | undefined,
  logger: CoreRoutesLogger | undefined,
  abortSignal?: AbortSignal,
) {
  const log = makeLogger(logger);
  const ack = acknowledge ?? defaultAcknowledge;
  return {
    description: END_RECOGNIZE_TASK_DESCRIPTION,
    toolName: END_RECOGNIZE_TASK,
    inputSchema: endRecognizeTaskInputSchema,
    execute: async (args: unknown) => {
      if (abortSignal?.aborted) {
        throw new Error("Request was aborted");
      }
      const { taskId } = (args ?? {}) as { taskId?: string };
      log.info(
        { taskId, clientId },
        `[tool][${END_RECOGNIZE_TASK}] Ending recognition task`,
      );

      try {
        const task = await readRecognizePlan(appDataDir, taskId ?? "", fs);

        if (!task) {
          log.error(
            { taskId, clientId },
            `[tool][${END_RECOGNIZE_TASK}] Task not found`,
          );
          return formatToolError(`Task with id "${taskId}" not found`);
        }

        if (task.files.length === 0) {
          log.warn(
            { taskId, clientId },
            `[tool][${END_RECOGNIZE_TASK}] No files in task`,
          );
          return formatToolError("No recognized files in task");
        }

        const fullPlanPath = planFilePath(appDataDir, task.id);
        const planFilePathInPosix = Path.posix(fullPlanPath);

        const data: RecognizeMediaFilePlanReadyRequestData = {
          taskId: task.id,
          planFilePath: planFilePathInPosix,
        };

        await ack(
          {
            event: RecognizeMediaFilePlanReady.event,
            data,
          },
          0,
        );

        log.info(
          {
            taskId,
            folderPath: task.mediaFolderPath,
            fileCount: task.files.length,
            clientId,
          },
          `[tool][${END_RECOGNIZE_TASK}] Task completed successfully`,
        );

        return toolOk({});
      } catch (error) {
        return formatToolError(error);
      }
    },
  };
}

/** Re-exported tool name constants for the tools registry. */
export const BEGIN_RECOGNIZE_TASK_TOOL_NAME = BEGIN_RECOGNIZE_TASK;
export const ADD_RECOGNIZED_MEDIA_FILE_TOOL_NAME = ADD_RECOGNIZED_MEDIA_FILE;
export const END_RECOGNIZE_TASK_TOOL_NAME = END_RECOGNIZE_TASK;
