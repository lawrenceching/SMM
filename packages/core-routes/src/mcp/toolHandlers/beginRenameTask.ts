import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Path } from "@smm/core/path";
import { metadataCacheFilePath } from "../../mediaMetadataCache.ts";
import { assertMediaFolderHasMetadata } from "@smm/core/plan/renamePlan";
import { defaultChatFs } from "../../chatFs.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  type McpToolResponse,
} from "../index.ts";
import type { McpConfig } from "../types.ts";
import {
  buildBeginRenameFilesTaskTool,
  type RenameFilesTaskDeps,
} from "../../tools/renameFilesTask.ts";
import { BEGIN_RENAME_FILES_TASK } from "@smm/core/types/ai-tools/renameFilesTask";

/**
 * Register the `begin-rename-task` MCP tool. Creates a new
 * rename-files task for a media folder and returns the task ID.
 *
 * Uses the existing core-routes agent toolset under the hood
 * (`buildBeginRenameFilesTaskTool` with `clientId="mcp"`); the
 * `ChatFs` abstraction keeps file I/O runtime-neutral.
 */
export function registerBeginRenameTaskTool(
  server: McpServer,
  config: McpConfig,
  deps: RenameFilesTaskDeps,
): void {
  const fs = config.fs ?? defaultChatFs();

  const agentTool = buildBeginRenameFilesTaskTool(
    "mcp",
    config.appDataDir,
    fs,
    deps,
    config.broadcast,
    config.logger,
    undefined,
  );

  const inputSchema = z.object({
    mediaFolderPath: z
      .string()
      .describe("The absolute path of the media folder, in POSIX or Windows format"),
  });

  server.registerTool(
    BEGIN_RENAME_FILES_TASK,
    {
      description: agentTool.description,
      inputSchema,
    },
    async (args: unknown): Promise<McpToolResponse> => {
      const { mediaFolderPath } = (args ?? {}) as { mediaFolderPath?: string };
      if (
        typeof mediaFolderPath !== "string" ||
        mediaFolderPath.trim() === ""
      ) {
        return createErrorResponse(
          "Invalid path: 'mediaFolderPath' must be a non-empty string",
        );
      }

      try {
        const result = await agentTool.execute({ mediaFolderPath });

        if (typeof result === "object" && result !== null && "error" in result) {
          const errorResult = result as { error?: string };
          if (errorResult.error) {
            return createErrorResponse(errorResult.error);
          }
        }

        if (typeof result === "object" && result !== null && "taskId" in result) {
          return createSuccessResponse({
            success: true,
            taskId: (result as { taskId: string }).taskId,
            mediaFolderPath: Path.posix(mediaFolderPath),
          });
        }

        return createSuccessResponse(result as { [x: string]: unknown });
      } catch (error) {
        return createErrorResponse(
          `Error starting rename task: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    },
  );
}
