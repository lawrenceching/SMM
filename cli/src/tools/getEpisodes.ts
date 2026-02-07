import { z } from "zod";
import type { ToolDefinition } from "./types";
import { createSuccessResponse, createErrorResponse } from "@/mcp/tools/mcpToolBase";
import { findMediaMetadata } from "@/utils/mediaMetadata";
import { Path } from "@core/path";
import logger from "../../lib/logger";
import { getLocalizedToolDescription } from '@/i18n/helpers';

export interface GetEpisodesParams {
  mediaFolderPath: string;
}

export async function handleGetEpisodes(
  params: GetEpisodesParams,
  abortSignal?: AbortSignal
): Promise<ReturnType<typeof createSuccessResponse> | ReturnType<typeof createErrorResponse>> {
  logger.info({
    params,
    file: "tools/getEpisodes.ts"
  }, "[MCP] get-episodes tool started")

  const { mediaFolderPath } = params;
  const traceId = `get-episodes-${Date.now()}`;

  // Validation
  if (abortSignal?.aborted) {
    logger.info({
      traceId,
      file: "tools/getEpisodes.ts"
    }, "[MCP] get-episodes tool aborted: abort signal detected")
    return createErrorResponse("Request was aborted");
  }

  if (!mediaFolderPath || typeof mediaFolderPath !== "string" || mediaFolderPath.trim() === "") {
    logger.warn({
      traceId,
      mediaFolderPath,
      reason: "media folder path is empty or invalid",
      file: "tools/getEpisodes.ts"
    }, "[MCP] get-episodes tool validation failed: invalid media folder path")
    return createErrorResponse("Invalid path: 'mediaFolderPath' must be a non-empty string");
  }

  // Convert path format
  const posixPath = Path.posix(mediaFolderPath);

  // Find metadata
  const metadata = await findMediaMetadata(posixPath);

  if (!metadata) {
    logger.warn({
      traceId,
      mediaFolderPath: posixPath,
      reason: "media metadata not found",
      file: "tools/getEpisodes.ts"
    }, "[MCP] get-episodes tool failed: media metadata not found")
    return createErrorResponse("TV show not found. Please ensure the media folder is opened in SMM.");
  }

  // Check if it's a TV show
  if (!metadata.tmdbTvShow) {
    logger.warn({
      traceId,
      mediaFolderPath: posixPath,
      reason: "not a TV show - no tmdbTvShow data",
      file: "tools/getEpisodes.ts"
    }, "[MCP] get-episodes tool failed: not a TV show folder")
    return createErrorResponse("Not a TV show folder. This tool only works with TV show media folders.");
  }

  logger.info({
    traceId,
    mediaFolderPath: posixPath,
    seasonCount: metadata.tmdbTvShow.seasons?.length || 0,
    mediaFileCount: metadata.mediaFiles?.length || 0,
    file: "tools/getEpisodes.ts"
  }, "[MCP] get-episodes tool: found media metadata, building episode list")

  // Build episode-to-video map from mediaFiles
  // Key format: "season:episode" (e.g., "1:5" for S01E05)
  const episodeToVideoMap = new Map<string, string>();
  if (metadata.mediaFiles && Array.isArray(metadata.mediaFiles)) {
    for (const mediaFile of metadata.mediaFiles) {
      if (mediaFile.seasonNumber !== undefined && mediaFile.episodeNumber !== undefined) {
        const key = `${mediaFile.seasonNumber}:${mediaFile.episodeNumber}`;
        episodeToVideoMap.set(key, mediaFile.absolutePath);
      }
    }
  }

  logger.info({
    traceId,
    mappedEpisodes: episodeToVideoMap.size,
    file: "tools/getEpisodes.ts"
  }, `[MCP] get-episodes tool: built episode-to-video map with ${episodeToVideoMap.size} entries`)

  // Extract all episodes from all TMDB seasons and combine with video paths
  const episodes: Array<{
    season: number;
    episode: number;
    videoFilePath?: string;
  }> = [];

  for (const season of metadata.tmdbTvShow.seasons || []) {
    if (season.episodes && Array.isArray(season.episodes)) {
      for (const tmdbEpisode of season.episodes) {
        const key = `${season.season_number}:${tmdbEpisode.episode_number}`;
        const videoFilePath = episodeToVideoMap.get(key);

        episodes.push({
          season: season.season_number,
          episode: tmdbEpisode.episode_number,
          videoFilePath: videoFilePath, // May be undefined - valid case!
        });
      }
    }
  }

  logger.info({
    traceId,
    episodeCount: episodes.length,
    episodesWithVideos: episodes.filter(e => e.videoFilePath).length,
    file: "tools/getEpisodes.ts"
  }, `[MCP] get-episodes tool: found ${episodes.length} episodes (${episodes.filter(e => e.videoFilePath).length} with video files)`)

  return createSuccessResponse({
    episodes,
    totalCount: episodes.length,
    showName: metadata.tmdbTvShow.name,
    numberOfSeasons: metadata.tmdbTvShow.number_of_seasons,
  });
}

export async function getTool(): Promise<ToolDefinition> {
  const description = await getLocalizedToolDescription('get-episodes');

  return {
    toolName: "get-episodes",
    description: description,
    inputSchema: z.object({
      mediaFolderPath: z.string().describe("The absolute path of the TV show media folder, in POSIX or Windows format"),
    }),
    outputSchema: z.object({
      episodes: z.array(z.object({
        season: z.number().describe("The season number"),
        episode: z.number().describe("The episode number"),
        videoFilePath: z.string().optional().describe("The absolute path of the video file, undefined if not recognized yet"),
      })).describe("Array of all episodes with their video file paths"),
      totalCount: z.number().describe("Total number of episodes"),
      showName: z.string().describe("The name of the TV show"),
      numberOfSeasons: z.number().describe("Number of seasons in the show"),
    }).strict(),
    execute: async (args: { mediaFolderPath: string }) => {
      return handleGetEpisodes(args);
    },
  };
}

export async function getEpisodesMcpTool() {
  return getTool();
}

export const createGetEpisodesTool = (clientId: string, abortSignal?: AbortSignal) => ({
  description: `Get all episodes for a TV show with their video file paths.
Combines TMDB episode data with local media file paths.
For each episode, returns season, episode number, and video file path.
The video file path may be undefined if the episode hasn't been recognized yet.`,
  inputSchema: z.object({
    mediaFolderPath: z.string().describe("The absolute path of the TV show media folder, in POSIX or Windows format"),
  }),
  execute: async ({ mediaFolderPath }: { mediaFolderPath: string }) => {
    if (abortSignal?.aborted) {
      throw new Error('Request was aborted');
    }

    const result = await handleGetEpisodes({ mediaFolderPath }, abortSignal);

    if (result.isError) {
      return {
        episodes: [],
        totalCount: 0,
        showName: "",
        numberOfSeasons: 0,
        message: result.content[0]?.text || "Unknown error"
      };
    }

    const content = result.structuredContent as {
      episodes: Array<{ season: number; episode: number; videoFilePath?: string }>;
      totalCount: number;
      showName: string;
      numberOfSeasons: number;
    };

    return {
      episodes: content.episodes || [],
      totalCount: content.totalCount || 0,
      showName: content.showName || "",
      numberOfSeasons: content.numberOfSeasons || 0,
    };
  },
});
