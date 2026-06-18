import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Path } from "@smm/core/path";
import {
  createErrorResponse,
  createSuccessResponse,
  type McpToolResponse,
} from "../index.ts";
import type { McpConfig } from "../types.ts";
import { readMediaMetadataCache } from "../../mediaMetadataCache.ts";

/**
 * Input schema for the MCP `get-episode` tool. Returns the absolute
 * platform-specific path of the video file for a given (season,
 * episode) tuple in a media folder.
 */
const getEpisodeInputSchema = z.object({
  mediaFolderPath: z
    .string()
    .describe(
      "The absolute path of the media folder, in POSIX or Windows format",
    ),
  season: z.number().describe("The season number of the episode"),
  episode: z.number().describe("The episode number"),
});

const getEpisodeOutputSchema = z
  .object({
    videoFilePath: z
      .string()
      .describe(
        "The absolute path of the video file in platform-specific format",
      ),
    season: z.number().describe("The season number"),
    episode: z.number().describe("The episode number"),
    message: z.string().describe("Status message"),
  })
  .strict();

const TOOL_NAME = "get-episode";
const TOOL_DESCRIPTION =
  "Get the absolute video file path for a single episode in a media folder. " +
  "Returns the resolved video file path plus a status message.";

/**
 * Register the `get-episode` MCP tool. Looks up the media metadata
 * cache, finds the matching (season, episode) entry, and returns
 * the video file path. Runtime-neutral — uses the metadata cache
 * helper from core-routes, which itself uses `node:fs/promises`.
 */
export function registerGetEpisodeTool(
  server: McpServer,
  config: McpConfig,
): void {
  const description = config.toolDescriptions?.[TOOL_NAME] ?? TOOL_DESCRIPTION;

  server.registerTool(
    TOOL_NAME,
    {
      description,
      inputSchema: getEpisodeInputSchema,
      outputSchema: getEpisodeOutputSchema,
    },
    async (args: unknown): Promise<McpToolResponse> => {
      const { mediaFolderPath, season, episode } = (args ?? {}) as {
        mediaFolderPath?: string;
        season?: number;
        episode?: number;
      };

      if (
        typeof mediaFolderPath !== "string" ||
        mediaFolderPath.trim() === ""
      ) {
        return createErrorResponse(
          "Invalid path: 'mediaFolderPath' must be a non-empty string",
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

      try {
        const metadata = await readMediaMetadataCache(
          config.appDataDir,
          mediaFolderPath,
        );

        if (!metadata) {
          return createSuccessResponse({
            videoFilePath: "",
            season,
            episode,
            message:
              "Media metadata not found. Please ensure the media folder is opened in SMM.",
          });
        }

        if (!metadata.mediaFiles || metadata.mediaFiles.length === 0) {
          return createSuccessResponse({
            videoFilePath: "",
            season,
            episode,
            message: "No media files found in the media folder metadata.",
          });
        }

        const matchingEpisode = metadata.mediaFiles.find(
          (mediaFile) =>
            mediaFile.seasonNumber === season &&
            mediaFile.episodeNumber === episode,
        );

        if (!matchingEpisode) {
          return createSuccessResponse({
            videoFilePath: "",
            season,
            episode,
            message: `Episode S${season}E${episode} not found in the media folder.`,
          });
        }

        const platformPath = Path.toPlatformPath(matchingEpisode.absolutePath);

        return createSuccessResponse({
          videoFilePath: platformPath,
          season,
          episode,
          message: "succeeded",
        });
      } catch (error) {
        return createErrorResponse(
          `Error getting episode: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    },
  );
}
