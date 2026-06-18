import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  GET_MEDIA_FOLDERS,
  GET_MEDIA_FOLDERS_DESCRIPTION,
  getMediaFoldersInputSchema,
  getMediaFoldersOutputSchema,
} from "@smm/core/types/ai-tools/getMediaFolders";
import {
  createErrorResponse,
  createSuccessResponse,
  type McpToolResponse,
} from "../index.ts";
import type { McpConfig } from "../types.ts";
import { executeGetMediaFolders } from "../../tools/getMediaFolders.ts";

/**
 * Register the `get-media-folders` MCP tool. Returns the list of
 * media folders imported by the user, with the currently-selected
 * folder marked. Reads the latest `UserConfig` on every request so
 * external AI assistants see up-to-date folder state.
 */
export function registerGetMediaFoldersTool(
  server: McpServer,
  config: McpConfig,
): void {
  const description =
    config.toolDescriptions?.[GET_MEDIA_FOLDERS] ??
    GET_MEDIA_FOLDERS_DESCRIPTION;

  server.registerTool(
    GET_MEDIA_FOLDERS,
    {
      description,
      inputSchema: getMediaFoldersInputSchema,
      outputSchema: getMediaFoldersOutputSchema,
    },
    async (): Promise<McpToolResponse> => {
      try {
        const userConfig = await config.getUserConfig();
        const result = await executeGetMediaFolders(userConfig);
        if (result.error) {
          return createErrorResponse(result.error);
        }
        const { error: _error, ...data } = result;
        return createSuccessResponse(data as { [x: string]: unknown });
      } catch (error) {
        return createErrorResponse(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  );
}
