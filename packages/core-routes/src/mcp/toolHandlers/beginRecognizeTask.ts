import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Path } from "@smm/core/path";
import { defaultChatFs } from "../../chatFs.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  type McpToolResponse,
} from "../index.ts";
import type { McpConfig } from "../types.ts";
import { buildBeginRecognizeTaskTool } from "../../tools/recognizeMediaFilesTask.ts";
import { BEGIN_RECOGNIZE_TASK } from "@smm/core/types/ai-tools/recognizeMediaFileTask";

/**
 * Register the `begin-recognize-task` MCP tool. Creates a new
 * recognise-media-file task for a media folder and returns the
 * task ID. Delegates to core-routes' runtime-neutral
 * {@link buildBeginRecognizeTaskTool}.
 */
export function registerBeginRecognizeTaskTool(
  server: McpServer,
  config: McpConfig,
): void {
  const fs = config.fs ?? defaultChatFs();

  const agentTool = buildBeginRecognizeTaskTool(
    "mcp",
    config.appDataDir,
    fs,
    config.logger,
    undefined,
  );

  const inputSchema = z.object({
    mediaFolderPath: z
      .string()
      .describe("The absolute path of the media folder"),
  });

  server.registerTool(
    BEGIN_RECOGNIZE_TASK,
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
          `Error starting recognize task: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    },
  );
}
