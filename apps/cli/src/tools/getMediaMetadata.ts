import { stat } from "node:fs/promises";
import { Path } from "@core/path";
import { findMediaMetadata } from "@/utils/mediaMetadata";
import { z } from "zod";
import type { ToolDefinition } from "./types";
import { createSuccessResponse, createErrorResponse } from "@/mcp/tools/mcpToolBase";
import { getLocalizedToolDescription } from '@/i18n/helpers';

export interface GetMediaMetadataParams {
  mediaFolderPath: string;
}


export interface GetMediaMetadataResponseTvShowEpisodeData {
  seasonNumber: number;
  episodeNumber: number;
  episodeName: string;
}

export interface GetMediaMetadataResponseTvShowSeasonData {
  seasonNumber: number;
  seasonName: string;
  episodes: GetMediaMetadataResponseTvShowEpisodeData[];
}

export interface GetMediaMetadataResponseTvShowData {
  tmdbId: number;
  name: string;
  seasons: GetMediaMetadataResponseTvShowSeasonData[];
}

export interface GetMediaMetadataResponseData {
  mediaFolderPath: string;
  type: "tvshow-folder" | "movie-folder" | "music-folder";
  tmdbTvShow?: GetMediaMetadataResponseTvShowData | string;
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

    // Build base response data
    const baseData: GetMediaMetadataResponseData = {
      mediaFolderPath: normalizedPath,
      type: "tvshow-folder",
    };

    // Check if folder exists
    try {
      const stats = await stat(normalizedPath);
      if (!stats.isDirectory()) {
        return createSuccessResponse({ data: { ...baseData }, error: "Path is not a directory" });
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return createSuccessResponse({ data: { ...baseData }, error: "Folder not found" });
      }
      throw error;
    }

    // Find metadata using POSIX path
    const posixPath = Path.posix(mediaFolderPath);
    const metadata = await findMediaMetadata(posixPath);

    if (!metadata) {
      return createSuccessResponse({ data: { ...baseData }, error: "No metadata cached for this folder" });
    }

    // Build GetMediaMetadataResponseData from metadata
    const data: GetMediaMetadataResponseData = {
      mediaFolderPath: metadata.mediaFolderPath || posixPath,
      type: metadata.type || "tvshow-folder",
    };

    // Transform TMDB TV show data if available
    if (metadata.tmdbTvShow) {
      data.tmdbTvShow = {
        tmdbId: metadata.tmdbTvShow.id,
        name: metadata.tmdbTvShow.name,
        seasons: metadata.tmdbTvShow.seasons?.map((season) => ({
          seasonNumber: season.season_number,
          seasonName: season.name,
          episodes: season.episodes?.map((episode) => ({
            seasonNumber: episode.season_number,
            episodeNumber: episode.episode_number,
            episodeName: episode.name,
          })) || [],
        })) || [],
      };
    } else {
      data.tmdbTvShow = "SMM未识别本文件夹, 请提示用户从SMM界面中搜索并匹配电视剧或动画"
    }

    return createSuccessResponse({ data });
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
      data: z.object({
        mediaFolderPath: z.string().describe("The path of the media folder"),
        type: z.enum(["tvshow-folder", "movie-folder", "music-folder"]).describe("The type of the media folder"),
        tmdbTvShow: z.union([
          z.object({
            tmdbId: z.number().describe("TMDB ID"),
            name: z.string().describe("Show name"),
            seasons: z.array(
              z.object({
                seasonNumber: z.number().describe("Season number"),
                seasonName: z.string().describe("Season name"),
                episodes: z.array(
                  z.object({
                    seasonNumber: z.number().describe("Season number"),
                    episodeNumber: z.number().describe("Episode number"),
                    episodeName: z.string().describe("Episode name"),
                  })
                ).describe("Episodes in the season"),
              })
            ).describe("Seasons"),
          }),
          z.string(),
        ]).optional().describe("TMDB TV show data or message if not recognized"),
      }).describe("Media metadata response data"),
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
/**
 * Returns a tool definition for AI agent usage.
 * Uses fixed English description for synchronous return.
 *
 * @param clientId - Socket.IO client ID (for tool execution, not language)
 * @param abortSignal - Optional abort signal for request cancellation
 * @returns Tool definition (synchronous)
 */
export function getMediaMetadataAgentTool(clientId: string, abortSignal?: AbortSignal) {
  return {
    description: "Get cached media metadata for a folder, including TMDB TV show or movie information.",
    inputSchema: z.object({
      mediaFolderPath: z.string().describe("The absolute path of the media folder"),
    }),
    outputSchema: z.object({
      mediaFolderPath: z.string(),
      type: z.string(),
      tmdbTvShow: z.any().optional(),
      tmdbMovie: z.any().optional(),
      error: z.string().optional(),
    }),
    execute: async ({ mediaFolderPath }: { mediaFolderPath: string }) => {
      if (abortSignal?.aborted) {
        throw new Error('Request was aborted');
      }

      if (!mediaFolderPath || typeof mediaFolderPath !== "string" || mediaFolderPath.trim() === "") {
        return createErrorResponse("Invalid path: mediaFolderPath must be a non-empty string");
      }

      try {
        const normalizedPath = Path.toPlatformPath(mediaFolderPath);

        const baseData: GetMediaMetadataResponseData = {
          mediaFolderPath: normalizedPath,
          type: "tvshow-folder",
        };

        try {
          const stats = await stat(normalizedPath);
          if (!stats.isDirectory()) {
            return createSuccessResponse({ data: { ...baseData }, error: "Path is not a directory" });
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return createSuccessResponse({ data: { ...baseData }, error: "Folder not found" });
          }
          throw error;
        }

        const posixPath = Path.posix(mediaFolderPath);
        const metadata = await findMediaMetadata(posixPath);

        if (!metadata) {
          return createSuccessResponse({ data: { ...baseData }, error: "No metadata cached for this folder" });
        }

        const data: GetMediaMetadataResponseData = {
          mediaFolderPath: metadata.mediaFolderPath || posixPath,
          type: metadata.type || "tvshow-folder",
        };

        if (metadata.tmdbTvShow) {
          data.tmdbTvShow = {
            tmdbId: metadata.tmdbTvShow.id,
            name: metadata.tmdbTvShow.name,
            seasons: metadata.tmdbTvShow.seasons?.map((season) => ({
              seasonNumber: season.season_number,
              seasonName: season.name,
              episodes: season.episodes?.map((episode) => ({
                seasonNumber: episode.season_number,
                episodeNumber: episode.episode_number,
                episodeName: episode.name,
              })) || [],
            })) || [],
          };
        } else {
          data.tmdbTvShow = "SMM未识别本文件夹, 请提示用户从SMM界面中搜索并匹配电视剧或动画"
        }

        return createSuccessResponse({ data });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return createErrorResponse(`Error reading media metadata: ${message}`);
      }
    },
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