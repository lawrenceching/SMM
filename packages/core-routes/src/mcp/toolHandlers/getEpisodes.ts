import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  GET_EPISODES,
  GET_EPISODES_DESCRIPTION,
  getEpisodesInputSchema,
  getEpisodesToolOutputSchema,
} from "@smm/core/types/ai-tools/getEpisodes";
import {
  createErrorResponse,
  createSuccessResponse,
  type McpToolResponse,
} from "../index.ts";
import type { McpConfig } from "../types.ts";
import { doGetEpisodes } from "../../getEpisodes.ts";
import type { CoreRoutesConfig } from "../../types.ts";

/**
 * Register the `get-episodes` MCP tool. Returns the list of episode
 * video files for a media folder, including the resolved video file
 * path, season, episode number, and episode title.
 */
export function registerGetEpisodesTool(
  server: McpServer,
  config: McpConfig,
): void {
  const description =
    config.toolDescriptions?.[GET_EPISODES] ?? GET_EPISODES_DESCRIPTION;

  server.registerTool(
    GET_EPISODES,
    {
      description,
      inputSchema: getEpisodesInputSchema,
      outputSchema: getEpisodesToolOutputSchema,
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
        const syntheticConfig: CoreRoutesConfig = {
          allowlist: [],
          hello: {
            version: "0.0.0",
            userDataDir: config.userDataDir,
            appDataDir: config.appDataDir,
            logDir: "",
            tmpDir: "",
            reverseProxyUrl: null,
            osLocale: "en-US",
            coreRoutesPort: 0,
          },
          appDataDir: config.appDataDir,
          logger: config.logger,
        };
        const result = await doGetEpisodes(
          { mediaFolderPath },
          syntheticConfig,
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
