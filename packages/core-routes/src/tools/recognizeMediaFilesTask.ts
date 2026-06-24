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
import { END_PLAN_TASK_SUCCESS_MESSAGE, PLAN_CANCELLED_BY_USER_MESSAGE } from "@smm/core/types/ai-tools/planTaskMessages";
import { formatToolError, toolError, toolOk } from "@smm/core/ai-tool/toolResult";
import {
  RecognizeMediaFilePlanReady,
  type RecognizeMediaFilePlanReadyRequestData,
} from "@smm/core/event-types";
import type { RecognizedFile } from "@smm/core/types/RecognizeMediaFilePlan";
import type { CoreRoutesLogger } from "../types.ts";
import { defaultBroadcast } from "./broadcast.ts";
import type { WebSocketMessage } from "../socketIO/types.ts";
import {
  appendRecognizedFile,
  beginRecognizePlan,
  defaultValidateRecognizedFiles,
  planFilePath,
  readRecognizePlan,
  updatePlanContent,
  type RecognizePlanAppendDeps,
} from "./plans.ts";
import type { ChatFs } from "../chatTypes.ts";

/**
 * Dependencies the `recognize-media-file-task` tools need in
 * addition to the runtime-neutral plumbing (`fs`, `logger`,
 * `appDataDir`). Mirrors the shape of {@link RenameFilesTaskDeps}
 * for the rename pipeline.
 *
 * - `validateFiles` — verifies each `path` exists on disk before
 *   adding it to the plan. Default uses {@link ChatFs.exists}; hosts
 *   may override (e.g. to surface richer diagnostics or to skip the
 *   check in tests).
 */
export interface RecognizeFilesTaskDeps {
  validateFiles?: RecognizePlanAppendDeps["validateFiles"];
}

export function defaultRecognizeFilesTaskDeps(
  fs: ChatFs,
): RecognizeFilesTaskDeps {
  return {
    validateFiles: (files) => defaultValidateRecognizedFiles(files, fs),
  };
}

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
  deps?: RecognizeFilesTaskDeps,
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
      const normalizedTaskId = (taskId ?? "").trim();
      log.info(
        { taskId: normalizedTaskId, season, episode, path: filePath, clientId },
        `[tool][${ADD_RECOGNIZED_MEDIA_FILE}] Adding file to task`,
      );

      try {
        const recognizedFile: RecognizedFile = {
          season: season ?? 0,
          episode: episode ?? 0,
          path: filePath ?? "",
        };
        await appendRecognizedFile(
          appDataDir,
          normalizedTaskId,
          recognizedFile,
          fs,
          { validateFiles: deps?.validateFiles },
        );

        log.info(
          {
            taskId: normalizedTaskId,
            season,
            episode,
            path: filePath,
            clientId,
          },
          `[tool][${ADD_RECOGNIZED_MEDIA_FILE}] File added to task successfully`,
        );

        return toolOk({});
      } catch (error) {
        log.error(
          {
            taskId: normalizedTaskId,
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
  broadcast: ((message: WebSocketMessage) => void) | undefined,
  logger: CoreRoutesLogger | undefined,
  abortSignal?: AbortSignal,
) {
  const log = makeLogger(logger);
  const emit = broadcast ?? defaultBroadcast;
  return {
    description: END_RECOGNIZE_TASK_DESCRIPTION,
    toolName: END_RECOGNIZE_TASK,
    inputSchema: endRecognizeTaskInputSchema,
    execute: async (args: unknown) => {
      if (abortSignal?.aborted) {
        throw new Error("Request was aborted");
      }
      const { taskId } = (args ?? {}) as { taskId?: string };
      const normalizedTaskId = (taskId ?? "").trim();
      log.info(
        { taskId: normalizedTaskId, clientId },
        `[tool][${END_RECOGNIZE_TASK}] Ending recognition task`,
      );

      try {
        const task = await readRecognizePlan(appDataDir, normalizedTaskId, fs);

        if (!task) {
          log.error(
            { taskId: normalizedTaskId, clientId },
            `[tool][${END_RECOGNIZE_TASK}] Task not found`,
          );
          return formatToolError(`Task with id "${normalizedTaskId}" not found`);
        }

        if (task.status === "rejected") {
          log.warn(
            { taskId: normalizedTaskId, clientId },
            `[tool][${END_RECOGNIZE_TASK}] Task cancelled by user`,
          );
          return toolError(PLAN_CANCELLED_BY_USER_MESSAGE);
        }

        if (task.files.length === 0) {
          log.warn(
            { taskId: normalizedTaskId, clientId },
            `[tool][${END_RECOGNIZE_TASK}] No files in task`,
          );
          return formatToolError("No recognized files in task");
        }

        // Flip preparing → pending so the plan becomes visible to the UI.
        await updatePlanContent(appDataDir, task.id, { status: "pending" }, fs);

        const fullPlanPath = planFilePath(appDataDir, task.id);
        const planFilePathInPosix = Path.posix(fullPlanPath);

        const data: RecognizeMediaFilePlanReadyRequestData = {
          taskId: task.id,
          planFilePath: planFilePathInPosix,
        };

        emit({
          event: RecognizeMediaFilePlanReady.event,
          data,
        });

        log.info(
          {
            taskId: normalizedTaskId,
            folderPath: task.mediaFolderPath,
            fileCount: task.files.length,
            clientId,
          },
          `[tool][${END_RECOGNIZE_TASK}] Task completed successfully`,
        );

        return toolOk({ message: END_PLAN_TASK_SUCCESS_MESSAGE });
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
