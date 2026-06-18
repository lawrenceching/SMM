import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  GET_MEDIA_METADATA,
  GET_MEDIA_METADATA_DESCRIPTION,
  getMediaMetadataInputSchema,
  getMediaMetadataToolOutputSchema,
} from "@smm/core/types/ai-tools/getMediaMetadata";
import {
  createErrorResponse,
  createSuccessResponse,
  type McpToolResponse,
} from "../index.ts";
import type { McpConfig } from "../types.ts";
import { executeGetMediaMetadata } from "../../tools/getMediaMetadata.ts";

/**
 * Register the `get-media-metadata` MCP tool. Reads the cached
 * metadata for a media folder and returns it. Reads the latest
 * `UserConfig` on every request.
 */
export function registerGetMediaMetadataTool(
  server: McpServer,
  config: McpConfig,
): void {
  const description =
    config.toolDescriptions?.[GET_MEDIA_METADATA] ??
    GET_MEDIA_METADATA_DESCRIPTION;

  server.registerTool(
    GET_MEDIA_METADATA,
    {
      description,
      inputSchema: getMediaMetadataInputSchema,
      outputSchema: getMediaMetadataToolOutputSchema,
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
        const userConfig = await config.getUserConfig();
        const result = await executeGetMediaMetadata(
          { mediaFolderPath },
          userConfig,
          config.appDataDir,
        );
        if (result.error) {
          return createSuccessResponse(result as { [x: string]: unknown });
        }
        return createSuccessResponse(result as { [x: string]: unknown });
      } catch (error) {
        return createErrorResponse(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  );
}
