import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Path } from "@smm/core/path";
import { extname } from "node:path";
import { videoFileExtensions } from "@smm/core/utils";
import { defaultChatFs } from "../../chatFs.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  type McpToolResponse,
} from "../index.ts";
import type { McpConfig } from "../types.ts";
import {
  buildAddRenameFileToTaskTool,
  type RenameFilesTaskDeps,
} from "../../tools/renameFilesTask.ts";
import { ADD_RENAME_FILE_TO_TASK } from "@smm/core/types/ai-tools/renameFilesTask";

/**
 * Register the `add-rename-file` MCP tool. Adds a single (from, to)
 * rename entry to an existing rename-files task.
 *
 * Validates that both `from` and `to` look like video files so
 * non-video files (subtitle, nfo, etc.) are rejected with a clear
 * message — matching the original `apps/cli` MCP behaviour.
 */
export function registerAddRenameFileTool(
  server: McpServer,
  config: McpConfig,
  deps: RenameFilesTaskDeps,
): void {
  const fs = config.fs ?? defaultChatFs();

  const agentTool = buildAddRenameFileToTaskTool(
    "mcp",
    config.appDataDir,
    fs,
    deps,
    config.logger,
    undefined,
  );

  const inputSchema = z.object({
    taskId: z
      .string()
      .describe("The task ID returned from begin-rename-task"),
    from: z
      .string()
      .describe("The current absolute path of the file to rename"),
    to: z
      .string()
      .describe("The new absolute path for the file"),
  });

  server.registerTool(
    ADD_RENAME_FILE_TO_TASK,
    {
      description: agentTool.description,
      inputSchema,
    },
    async (args: unknown): Promise<McpToolResponse> => {
      const { taskId, from, to } = (args ?? {}) as {
        taskId?: string;
        from?: string;
        to?: string;
      };

      if (typeof taskId !== "string" || taskId.trim() === "") {
        return createErrorResponse(
          "Invalid taskId: 'taskId' must be a non-empty string",
        );
      }
      if (typeof from !== "string" || from.trim() === "") {
        return createErrorResponse(
          "Invalid path: 'from' must be a non-empty string",
        );
      }
      if (typeof to !== "string" || to.trim() === "") {
        return createErrorResponse(
          "Invalid path: 'to' must be a non-empty string",
        );
      }
      if (!isVideoFile(from)) {
        return createErrorResponse(
          "Invalid path: 'from' must be a video file",
        );
      }
      if (!isVideoFile(to)) {
        return createErrorResponse(
          "Invalid path: 'to' must be a video file",
        );
      }

      try {
        await agentTool.execute({
          taskId,
          from: Path.posix(from),
          to: Path.posix(to),
        });
        return createSuccessResponse({ success: true, taskId });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        if (message.includes("Not Episode Video File")) {
          return createErrorResponse(
            `"${from}" is not video file to any episode, you're not allowed to rename it. ` +
              `Call "get-episodes" tool to get the list of episode video files that needs to rename.`,
          );
        }
        return createErrorResponse(message);
      }
    },
  );
}

function isVideoFile(filePath: string): boolean {
  const extension = extname(filePath).toLowerCase();
  return videoFileExtensions.includes(extension);
}
