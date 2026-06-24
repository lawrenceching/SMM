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
import {
  buildAddRecognizedMediaFileTool,
  defaultRecognizeFilesTaskDeps,
} from "../../tools/recognizeMediaFilesTask.ts";
import { defaultValidateRecognizedFiles } from "../../tools/plans.ts";
import { ADD_RECOGNIZED_MEDIA_FILE } from "@smm/core/types/ai-tools/recognizeMediaFileTask";

/**
 * Register the `add-recognized-file` MCP tool. Adds a single
 * `(season, episode, path)` entry to an existing recognize task.
 *
 * The underlying agent tool performs a filesystem-existence check on
 * the path via {@link defaultValidateRecognizedFiles}. Errors from
 * that check, plus any other validation failure, are surfaced to the
 * MCP client as `success: false` payloads so the AI sees a failed
 * tool call instead of a silent success.
 */
export function registerAddRecognizedFileTool(
  server: McpServer,
  config: McpConfig,
): void {
  const fs = config.fs ?? defaultChatFs();
  const deps = defaultRecognizeFilesTaskDeps(fs);

  const agentTool = buildAddRecognizedMediaFileTool(
    "mcp",
    config.appDataDir,
    fs,
    config.logger,
    undefined,
    deps,
  );

  const inputSchema = z.object({
    taskId: z
      .string()
      .describe("The task ID from begin-recognize-task"),
    season: z.number().describe("The season number of the episode"),
    episode: z.number().describe("The episode number"),
    path: z
      .string()
      .describe(
        "The absolute path of the media file (POSIX or Windows format)",
      ),
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
        const result = await agentTool.execute({
          taskId,
          season,
          episode,
          path: Path.posix(path),
        });

        // Agent tools return `{ error: "..." }` instead of throwing
        // when validation fails (e.g. file does not exist on disk).
        // Surface those failures to the MCP client so the AI model
        // does not silently add a non-existent file to the plan.
        if (
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
        ) {
          return createSuccessResponse({
            success: false,
            error: result.error,
          });
        }

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
