import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { defaultChatFs } from "../../chatFs.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  type McpToolResponse,
} from "../index.ts";
import type { McpConfig } from "../types.ts";
import {
  buildEndRenameFilesTaskTool,
  type RenameFilesTaskDeps,
} from "../../tools/renameFilesTask.ts";
import { END_RENAME_FILES_TASK } from "@smm/core/types/ai-tools/renameFilesTask";

/**
 * Register the `end-rename-task` MCP tool. Finalises a rename task
 * and broadcasts a Socket.IO `RenameFilesPlanReady` event so the UI
 * can pick up the plan.
 */
export function registerEndRenameTaskTool(
  server: McpServer,
  config: McpConfig,
  deps: RenameFilesTaskDeps,
): void {
  const fs = config.fs ?? defaultChatFs();

  const agentTool = buildEndRenameFilesTaskTool(
    "mcp",
    config.appDataDir,
    fs,
    config.acknowledge,
    config.logger,
    undefined,
  );

  const inputSchema = z.object({
    taskId: z
      .string()
      .describe("The task ID returned from begin-rename-task"),
  });

  server.registerTool(
    END_RENAME_FILES_TASK,
    {
      description: agentTool.description,
      inputSchema,
    },
    async (args: unknown): Promise<McpToolResponse> => {
      const { taskId } = (args ?? {}) as { taskId?: string };
      if (typeof taskId !== "string" || taskId.trim() === "") {
        return createErrorResponse(
          "Invalid taskId: 'taskId' must be a non-empty string",
        );
      }

      try {
        const result = await agentTool.execute({ taskId });

        if (typeof result === "object" && result !== null && "error" in result) {
          const errorResult = result as { error?: string };
          if (errorResult.error) {
            return createSuccessResponse({
              success: false,
              error: errorResult.error,
            });
          }
        }

        return createSuccessResponse({ success: true, taskId });
      } catch (error) {
        return createErrorResponse(
          `Error ending rename task: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    },
  );
}
