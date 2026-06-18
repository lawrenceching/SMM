import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  IS_FOLDER_EXIST,
  IS_FOLDER_EXIST_DESCRIPTION,
  isFolderExistInputSchema,
  isFolderExistOutputSchema,
} from "@smm/core/types/ai-tools/isFolderExist";
import {
  createErrorResponse,
  createSuccessResponse,
  type McpToolResponse,
} from "../index.ts";
import type { McpConfig } from "../types.ts";
import { executeIsFolderExist } from "../../tools/isFolderExist.ts";

/**
 * Register the `is-folder-exist` MCP tool.
 *
 * Thin wrapper around {@link executeIsFolderExist} from core-routes'
 * agent toolset. The result is wrapped into an {@link McpToolResponse}
 * via {@link createSuccessResponse}; any thrown error becomes an
 * `isError: true` response.
 */
export function registerIsFolderExistTool(
  server: McpServer,
  config: McpConfig,
): void {
  const description =
    config.toolDescriptions?.[IS_FOLDER_EXIST] ?? IS_FOLDER_EXIST_DESCRIPTION;

  server.registerTool(
    IS_FOLDER_EXIST,
    {
      description,
      inputSchema: isFolderExistInputSchema,
      outputSchema: isFolderExistOutputSchema,
    },
    async (args: unknown): Promise<McpToolResponse> => {
      const { path } = (args ?? {}) as { path?: string };
      if (typeof path !== "string" || path.trim() === "") {
        return createErrorResponse(
          "Invalid path: 'path' must be a non-empty string",
        );
      }
      try {
        const result = await executeIsFolderExist(path);
        return createSuccessResponse(result as { [x: string]: unknown });
      } catch (error) {
        return createErrorResponse(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  );
}
