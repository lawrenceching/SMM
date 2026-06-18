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
import { buildAddRecognizedMediaFileTool } from "../../tools/recognizeMediaFilesTask.ts";
import { ADD_RECOGNIZED_MEDIA_FILE } from "@smm/core/types/ai-tools/recognizeMediaFileTask";

/**
 * Register the `add-recognized-file` MCP tool. Adds a single
 * `(season, episode, path)` entry to an existing recognize task.
 */
export function registerAddRecognizedFileTool(
  server: McpServer,
  config: McpConfig,
): void {
  const fs = config.fs ?? defaultChatFs();

  const agentTool = buildAddRecognizedMediaFileTool(
    "mcp",
    config.appDataDir,
    fs,
    config.logger,
    undefined,
  );

  const inputSchema = z.object({
    taskId: z
      .string()
      .describe("The task ID from begin-recognize-task"),
    season: z.number().describe("The season number of the episode"),
    episode: z.number().describe("The episode number"),
    path: z
      .string()
      .describe("The absolute path of the media file"),
  });

  server.registerTool(
    ADD_RECOGNIZED_MEDIA_FILE,
    {
      description: agentTool.description,
      inputSchema,
    },
    async (args: unknown): Promise<McpToolResponse> => {
      const { taskId, season, episode, path } = (args ?? {}) as {
        taskId?: string;
        season?: number;
        episode?: number;
        path?: string;
      };

      if (typeof taskId !== "string" || taskId.trim() === "") {
        return createErrorResponse(
          "Invalid taskId: 'taskId' must be a non-empty string",
        );
      }
      if (typeof season !== "number" || season < 0) {
        return createErrorResponse(
          "Invalid season: 'season' must be a non-negative number",
        );
      }
      if (typeof episode !== "number" || episode < 0) {
        return createErrorResponse(
          "Invalid episode: 'episode' must be a non-negative number",
        );
      }
      if (typeof path !== "string" || path.trim() === "") {
        return createErrorResponse(
          "Invalid path: 'path' must be a non-empty string",
        );
      }

      try {
        await agentTool.execute({
          taskId,
          season,
          episode,
          path: Path.posix(path),
        });
        return createSuccessResponse({ success: true, taskId });
      } catch (error) {
        return createErrorResponse(
          `Error adding recognized file: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    },
  );
}
