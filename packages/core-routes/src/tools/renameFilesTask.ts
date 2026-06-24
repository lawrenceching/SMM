import path from "node:path";
import { Path } from "@smm/core/path";
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
} from "@smm/core/types/ai-tools/renameFilesTask";
import { assertMediaFolderHasMetadata } from "@smm/core/plan/renamePlan";
import { END_PLAN_TASK_SUCCESS_MESSAGE, PLAN_CANCELLED_BY_USER_MESSAGE } from "@smm/core/types/ai-tools/planTaskMessages";
import { formatToolError, toolError, toolOk } from "@smm/core/ai-tool/toolResult";
import {
  RenameFilesPlanReady,
  type RenameFilesPlanReadyRequestData,
} from "@smm/core/event-types";
import type { CoreRoutesLogger } from "../types.ts";
import { metadataCacheFilePath } from "../mediaMetadataCache.ts";
import { defaultBroadcast } from "./broadcast.ts";
import type { WebSocketMessage } from "../socketIO/types.ts";
import {
  appendRenamePlanEntry,
  beginRenamePlan,
  planFilePath,
  readRenamePlan,
  updatePlanContent,
  type RenamePlanAppendDeps,
} from "./plans.ts";
import type { ChatFs } from "../chatTypes.ts";

/**
 * Dependencies the `rename-files-task` tools need in addition to the
 * chat config. Injected by the host (cli / ohos) because the
 * underlying validation + filesystem checks are not in
 * `core-routes`. The cli wires its existing
 * `validateRenameOperations` to `validateOperations` and its
 * `findMediaMetadata` to `getMediaMetadata`.
 */
export interface RenameFilesTaskDeps {
  validateOperations: RenamePlanAppendDeps["validateOperations"];
  getMediaMetadata: RenamePlanAppendDeps["getMediaMetadata"];
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

export function buildBeginRenameFilesTaskTool(
  clientId: string,
  appDataDir: string,
  fs: ChatFs,
  _deps: RenameFilesTaskDeps,
  broadcast: ((message: WebSocketMessage) => void) | undefined,
  logger: CoreRoutesLogger | undefined,
  abortSignal?: AbortSignal,
) {
  const log = makeLogger(logger);
  const emit = broadcast ?? defaultBroadcast;
  return {
    description: BEGIN_RENAME_FILES_TASK_DESCRIPTION,
    toolName: BEGIN_RENAME_FILES_TASK,
    inputSchema: beginRenameFilesTaskInputSchema,
    execute: async (args: unknown) => {
      if (abortSignal?.aborted) {
        throw new Error("Request was aborted");
      }
      const { mediaFolderPath } = (args ?? {}) as { mediaFolderPath?: string };
      log.info(
        { mediaFolderPath, clientId },
        `[tool][${BEGIN_RENAME_FILES_TASK}] Starting new rename task`,
      );

      const folderPathInPosix = Path.posix(mediaFolderPath ?? "");
      const metadataFilePath = metadataCacheFilePath(appDataDir, folderPathInPosix);
      const metadataExists = await fs.exists(metadataFilePath);

      const metadataError = assertMediaFolderHasMetadata(
        metadataExists,
        folderPathInPosix,
      );
      if (metadataError) {
        log.warn(
          { folderPath: folderPathInPosix },
          `[tool][${BEGIN_RENAME_FILES_TASK}] Media metadata not found`,
        );
        return toolError(metadataError.replace(/^Error Reason: /, ""));
      }

      try {
        const taskId = await beginRenamePlan(appDataDir, folderPathInPosix, fs);
        log.info(
          { taskId, mediaFolderPath: folderPathInPosix, clientId },
          `[tool][${BEGIN_RENAME_FILES_TASK}] Task created successfully`,
        );
        // Notify the UI so it can re-fetch active plans and show the
        // "generating" prompt while the plan is still preparing.
        const fullPlanPath = planFilePath(appDataDir, taskId);
        const planFilePathInPosix = Path.posix(fullPlanPath);
        const data: RenameFilesPlanReadyRequestData = {
          taskId,
          planFilePath: planFilePathInPosix,
        };
        emit({
          event: RenameFilesPlanReady.event,
          data,
        });
        log.info(
          { taskId, mediaFolderPath: folderPathInPosix, clientId, broadcast: true },
          `[tool][${BEGIN_RENAME_FILES_TASK}] RenameFilesPlanReady broadcast sent`,
        );
        return toolOk({ taskId });
      } catch (error) {
        log.error(
          {
            mediaFolderPath: folderPathInPosix,
            error: error instanceof Error ? error.message : String(error),
            clientId,
          },
          `[tool][${BEGIN_RENAME_FILES_TASK}] Failed to create task`,
        );
        return formatToolError(error);
      }
    },
  };
}

export function buildAddRenameFileToTaskTool(
  clientId: string,
  appDataDir: string,
  fs: ChatFs,
  deps: RenameFilesTaskDeps,
  logger: CoreRoutesLogger | undefined,
  abortSignal?: AbortSignal,
) {
  const log = makeLogger(logger);
  return {
    description: ADD_RENAME_FILE_TO_TASK_DESCRIPTION,
    toolName: ADD_RENAME_FILE_TO_TASK,
    inputSchema: addRenameFileToTaskInputSchema,
    execute: async (args: unknown) => {
      if (abortSignal?.aborted) {
        throw new Error("Request was aborted");
      }
      const { taskId, from, to } = (args ?? {}) as {
        taskId?: string;
        from?: string;
        to?: string;
      };
      const normalizedTaskId = (taskId ?? "").trim();
      log.info(
        { taskId: normalizedTaskId, from, to, clientId },
        `[tool][${ADD_RENAME_FILE_TO_TASK}] Adding file to task`,
      );

      try {
        await appendRenamePlanEntry(
          appDataDir,
          normalizedTaskId,
          from ?? "",
          to ?? "",
          fs,
          deps,
        );
        log.info(
          { taskId: normalizedTaskId, from, to, clientId },
          `[tool][${ADD_RENAME_FILE_TO_TASK}] File added successfully`,
        );
        return toolOk({});
      } catch (error) {
        log.error(
          {
            taskId: normalizedTaskId,
            from,
            to,
            error: error instanceof Error ? error.message : String(error),
            clientId,
          },
          `[tool][${ADD_RENAME_FILE_TO_TASK}] Failed to add file`,
        );
        return formatToolError(error);
      }
    },
  };
}

export function buildEndRenameFilesTaskTool(
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
    description: END_RENAME_FILES_TASK_DESCRIPTION,
    toolName: END_RENAME_FILES_TASK,
    inputSchema: endRenameFilesTaskInputSchema,
    execute: async (args: unknown) => {
      if (abortSignal?.aborted) {
        throw new Error("Request was aborted");
      }
      const { taskId } = (args ?? {}) as { taskId?: string };
      const normalizedTaskId = (taskId ?? "").trim();
      log.info(
        { taskId: normalizedTaskId, clientId },
        `[tool][${END_RENAME_FILES_TASK}] Ending rename task`,
      );

      try {
        const task = await readRenamePlan(appDataDir, normalizedTaskId, fs);

        if (!task) {
          log.error(
            { taskId: normalizedTaskId, clientId },
            `[tool][${END_RENAME_FILES_TASK}] Task not found`,
          );
          return toolError(`Task with id "${normalizedTaskId}" not found`);
        }

        if (task.status === "rejected") {
          log.warn(
            { taskId: normalizedTaskId, clientId },
            `[tool][${END_RENAME_FILES_TASK}] Task cancelled by user`,
          );
          return toolError(PLAN_CANCELLED_BY_USER_MESSAGE);
        }

        if (task.files.length === 0) {
          log.warn(
            { taskId: normalizedTaskId, clientId },
            `[tool][${END_RENAME_FILES_TASK}] No files in task`,
          );
          return toolError("No rename entries in task");
        }

        // Flip preparing → pending so the plan becomes visible to the UI.
        await updatePlanContent(appDataDir, task.id, { status: "pending" }, fs);

        const fullPlanPath = planFilePath(appDataDir, task.id);
        const planFilePathInPosix = Path.posix(fullPlanPath);

        const data: RenameFilesPlanReadyRequestData = {
          taskId: task.id,
          planFilePath: planFilePathInPosix,
        };

        // Fire-and-forget notify — UI listens via broadcast, not ack.
        emit({
          event: RenameFilesPlanReady.event,
          data,
        });

        log.info(
          { taskId: normalizedTaskId, fileCount: task.files.length, clientId },
          `[tool][${END_RENAME_FILES_TASK}] Plan ready, UI notified`,
        );

        return toolOk({ message: END_PLAN_TASK_SUCCESS_MESSAGE });
      } catch (error) {
        log.error(
          {
            taskId: normalizedTaskId,
            error: error instanceof Error ? error.message : String(error),
            clientId,
          },
          `[tool][${END_RENAME_FILES_TASK}] End task error`,
        );
        return formatToolError(error);
      }
    },
  };
}

/** Re-exported tool name constants for the tools registry. */
export const BEGIN_RENAME_FILES_TASK_TOOL_NAME = BEGIN_RENAME_FILES_TASK;
export const ADD_RENAME_FILE_TO_TASK_TOOL_NAME = ADD_RENAME_FILE_TO_TASK;
export const END_RENAME_FILES_TASK_TOOL_NAME = END_RENAME_FILES_TASK;
