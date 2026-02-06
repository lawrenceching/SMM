import { stat } from "node:fs/promises";
import { Path } from "@core/path";
import { findMediaMetadata } from "@/utils/mediaMetadata";
import { listFiles } from "@/utils/files";
import type { MediaMetadata } from "@core/types";
import { z } from "zod";
import type { ToolDefinition } from "./types";
import { createSuccessResponse, createErrorResponse } from "@/mcp/tools/mcpToolBase";
import { getLocalizedToolDescription } from '@/i18n/helpers';

export interface GetMediaMetadataParams {
  mediaFolderPath: string;
}

/**
 * Get media metadata for a folder.
 * Returns the cached metadata if it exists.
 */
export async function handleGetMediaMetadata(
  params: GetMediaMetadataParams,
  abortSignal?: AbortSignal
): Promise<ReturnType<typeof createSuccessResponse> | ReturnType<typeof createErrorResponse>> {
  const { mediaFolderPath } = params;

  if (abortSignal?.aborted) {
    return createErrorResponse("Request was aborted");
  }

  if (!mediaFolderPath || typeof mediaFolderPath !== "string" || mediaFolderPath.trim() === "") {
    return createErrorResponse("Invalid path: mediaFolderPath must be a non-empty string");
  }

  try {
    const normalizedPath = Path.toPlatformPath(mediaFolderPath);

    // Check if folder exists
    try {
      const stats = await stat(normalizedPath);
      if (!stats.isDirectory()) {
        return createSuccessResponse({ error: "Path is not a directory" });
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return createSuccessResponse({ error: "Folder not found" });
      }
      throw error;
    }

    // Find metadata using POSIX path
    const posixPath = Path.posix(mediaFolderPath);
    const metadata = await findMediaMetadata(posixPath);

    if (!metadata) {
      return createSuccessResponse({ error: "No metadata cached for this folder" });
    }

    // Update files list from actual folder
    const files = await listFiles(new Path(normalizedPath), true);
    const metadataWithFiles: MediaMetadata & { files: string[] } = {
      ...metadata,
      files,
    };

    return createSuccessResponse({ metadata: metadataWithFiles, files });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return createErrorResponse(`Error reading media metadata: ${message}`);
  }
}

export const getTool = async function (abortSignal?: AbortSignal): Promise<ToolDefinition> {
  // Use i18n to get localized tool description based on global user's language preference
  const description = await getLocalizedToolDescription('get-media-metadata');

  return {
    toolName: "get-media-metadata",
    description: description,
    inputSchema: z.object({
      mediaFolderPath: z.string().describe("The absolute path of the media folder"),
    }),
    outputSchema: z.object({
      metadata: z
        .object({
          mediaFolderPath: z.string().describe("The path of the media folder"),
          type: z.enum(["tvshow-folder", "movie-folder", "music-folder"]).describe("The type of the media folder"),
          mediaName: z.string().optional().describe("The name of the media"),
          tmdbId: z.number().optional().describe("The TMDB ID"),
          tmdbTvShow: z
            .object({
              id: z.number().describe("TMDB show ID"),
              name: z.string().describe("Show name"),
              poster_path: z.string().nullable().describe("Poster path"),
              backdrop_path: z.string().nullable().describe("Backdrop path"),
              seasons: z
                .array(
                  z.object({
                    season_number: z.number().describe("Season number"),
                    name: z.string().describe("Season name"),
                    episode_count: z.number().describe("Number of episodes"),
                    episodes: z
                      .array(
                        z.object({
                          episode_number: z.number().describe("Episode number"),
                          name: z.string().describe("Episode name"),
                        })
                      )
                      .describe("Episodes in the season"),
                  })
                )
                .describe("Seasons"),
            })
            .optional()
            .describe("TMDB TV show data"),
        })
        .optional()
        .describe("Media metadata"),
      files: z.array(z.string()).describe("List of files in the folder"),
      error: z.string().optional().describe("Error message if not found"),
    }),
    execute: async (args: { mediaFolderPath: string }) => {
      return handleGetMediaMetadata(args, abortSignal);
    },
  };
}

/**
 * Returns a tool definition with localized description for AI agent usage.
 * The description is localized based on the global user's language preference.
 *
 * @param clientId - Socket.IO client ID (for tool execution, not language)
 * @param abortSignal - Optional abort signal for request cancellation
 * @returns Promise resolving to localized tool definition
 */
export async function getMediaMetadataAgentTool(clientId: string, abortSignal?: AbortSignal) {
  const tool = await getTool(abortSignal);
  return {
    description: tool.description,
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
    execute: (args: any) => tool.execute(args),
  };
}

/**
 * Returns a tool definition with localized description for MCP server usage.
 * MCP tools use the global user's language preference.
 *
 * @returns Promise resolving to tool definition
 */
export async function getMediaMetadataMcpTool() {
  return getTool();
}