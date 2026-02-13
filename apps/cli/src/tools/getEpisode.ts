import { z } from "zod";
import type { ToolDefinition } from "./types";
import { createSuccessResponse, createErrorResponse } from "@/mcp/tools/mcpToolBase";
import { findMediaMetadata } from "@/utils/mediaMetadata";
import { Path } from "@core/path";
import logger from "../../lib/logger";
import { getLocalizedToolDescription } from '@/i18n/helpers';

export interface GetEpisodeParams {
  mediaFolderPath: string;
  season: number;
  episode: number;
}

export async function handleGetEpisode(
  params: GetEpisodeParams,
  abortSignal?: AbortSignal
): Promise<ReturnType<typeof createSuccessResponse> | ReturnType<typeof createErrorResponse>> {
  logger.info({
    params,
    file: "tools/getEpisode.ts"
  }, "[MCP] get-episode tool started")

  const { mediaFolderPath, season, episode } = params;
  const traceId = `get-episode-${Date.now()}`;

  if (abortSignal?.aborted) {
    logger.info({
      traceId,
      file: "tools/getEpisode.ts"
    }, "[MCP] get-episode tool aborted: abort signal detected")
    return createErrorResponse("Request was aborted");
  }

  if (!mediaFolderPath || typeof mediaFolderPath !== "string" || mediaFolderPath.trim() === "") {
    logger.warn({
      traceId,
      mediaFolderPath,
      reason: "media folder path is empty or invalid",
      file: "tools/getEpisode.ts"
    }, "[MCP] get-episode tool validation failed: invalid media folder path")
    return createSuccessResponse({
      videoFilePath: "",
      season: 0,
      episode: 0,
      message: "Invalid path: 'mediaFolderPath' must be a non-empty string"
    });
  }

  if (typeof season !== "number" || season < 0) {
    logger.warn({
      traceId,
      season,
      reason: "season number is invalid",
      file: "tools/getEpisode.ts"
    }, "[MCP] get-episode tool validation failed: invalid season number")
    return createSuccessResponse({
      videoFilePath: "",
      season: 0,
      episode: 0,
      message: "Invalid season: 'season' must be a non-negative number"
    });
  }

  if (typeof episode !== "number" || episode < 0) {
    logger.warn({
      traceId,
      episode,
      reason: "episode number is invalid",
      file: "tools/getEpisode.ts"
    }, "[MCP] get-episode tool validation failed: invalid episode number")
    return createSuccessResponse({
      videoFilePath: "",
      season: 0,
      episode: 0,
      message: "Invalid episode: 'episode' must be a non-negative number"
    });
  }

  logger.info({
    traceId,
    mediaFolderPath,
    season,
    episode,
    file: "tools/getEpisode.ts"
  }, "[MCP] get-episode tool parameters validated, proceeding to find media metadata")

  try {
    const metadata = await findMediaMetadata(mediaFolderPath);

    if (!metadata) {
      logger.warn({
        traceId,
        mediaFolderPath: mediaFolderPath,
        reason: "media metadata not found",
        file: "tools/getEpisode.ts"
      }, "[MCP] get-episode tool failed: media metadata not found")
      return createSuccessResponse({
        videoFilePath: "",
        season,
        episode,
        message: "Media metadata not found. Please ensure the media folder is opened in SMM."
      });
    }

    logger.info({
      traceId,
      mediaFolderPath: mediaFolderPath,
      mediaFilesCount: metadata.mediaFiles?.length || 0,
      file: "tools/getEpisode.ts"
    }, "[MCP] get-episode tool: found media metadata, searching for episode")

    if (!metadata.mediaFiles || metadata.mediaFiles.length === 0) {
      logger.warn({
        traceId,
        mediaFolderPath: mediaFolderPath,
        reason: "no media files in metadata",
        file: "tools/getEpisode.ts"
      }, "[MCP] get-episode tool failed: no media files found in metadata")
      return createSuccessResponse({
        videoFilePath: "",
        season,
        episode,
        message: "No media files found in the media folder metadata."
      });
    }

    const matchingEpisode = metadata.mediaFiles.find(
      mediaFile => mediaFile.seasonNumber === season && mediaFile.episodeNumber === episode
    );

    if (!matchingEpisode) {
      logger.warn({
        traceId,
        mediaFolderPath: mediaFolderPath,
        season,
        episode,
        reason: "episode not found in media files",
        file: "tools/getEpisode.ts"
      }, `[MCP] get-episode tool: episode S${season}E${episode} not found in media files`)
      return createSuccessResponse({
        videoFilePath: "",
        season,
        episode,
        message: `Episode S${season}E${episode} not found in the media folder.`
      });
    }

    const absolutePath = matchingEpisode.absolutePath;

    // Convert POSIX path to platform-specific path for MCP client
    const platformPath = Path.toPlatformPath(absolutePath);

    logger.info({
      traceId,
      mediaFolderPath: mediaFolderPath,
      season,
      episode,
      videoFilePath: platformPath,
      file: "tools/getEpisode.ts"
    }, `[MCP] get-episode tool: found episode S${season}E${episode}`)

    const response = createSuccessResponse({
      videoFilePath: platformPath,
      season,
      episode,
      message: "succeeded"
    });

    logger.info({
      params,
      file: "tools/getEpisode.ts",
      response,
    }, "[MCP] get-episode tool ended")

    return response;
  } catch (error) {
    logger.error({
      params,
      file: "tools/getEpisode.ts",
      error: error instanceof Error ? error.message : String(error),
    }, "[MCP] get-episode tool ended with error")
    const message = error instanceof Error ? error.message : String(error);
    return createSuccessResponse({
      videoFilePath: "",
      season,
      episode,
      message: `Error getting episode: ${message}`
    });
  }
}

export async function getTool(abortSignal?: AbortSignal): Promise<ToolDefinition> {
  const description = await getLocalizedToolDescription('get-episode');

  return {
    toolName: "get-episode",
    description: description,
    inputSchema: z.object({
      mediaFolderPath: z.string().describe("The absolute path of the media folder, in POSIX or Windows format"),
      season: z.number().describe("The season number of the episode"),
      episode: z.number().describe("The episode number"),
    }),
    outputSchema: z.object({
      videoFilePath: z.string().describe("The absolute path of the video file in platform-specific format (Windows or POSIX)"),
      season: z.number().describe("The season number"),
      episode: z.number().describe("The episode number"),
      message: z.string().describe("Status message: 'succeeded' or error message"),
    }).strict(),
    execute: async (args: { mediaFolderPath: string; season: number; episode: number }) => {
      return handleGetEpisode(args, abortSignal);
    },
  };
}

export async function getEpisodeAgentTool(clientId: string, abortSignal?: AbortSignal) {
  const tool = await getTool(abortSignal);
  return {
    description: tool.description,
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
    execute: async (args: { mediaFolderPath: string; season: number; episode: number }) => {
      if (abortSignal?.aborted) {
        throw new Error("Request was aborted");
      }
      return handleGetEpisode(args, abortSignal);
    },
  };
}

export async function getEpisodeMcpTool() {
  return getTool();
}

export const createGetEpisodeTool = (clientId: string, abortSignal?: AbortSignal) => ({
  description: `Get episode information from a media folder in SMM.
This tool accepts the media folder path, season number, and episode number.
It returns the absolute video file path for the specified episode.

Example: Get episode S1E5 from folder "/path/to/TV Show".`,
  inputSchema: z.object({
    mediaFolderPath: z.string().describe("The absolute path of the media folder, in POSIX or Windows format"),
    season: z.number().describe("The season number of the episode"),
    episode: z.number().describe("The episode number"),
  }),
  execute: async ({ mediaFolderPath, season, episode }: { mediaFolderPath: string; season: number; episode: number }) => {
    if (abortSignal?.aborted) {
      throw new Error("Request was aborted");
    }

    const result = await handleGetEpisode({ mediaFolderPath, season, episode }, abortSignal);

    if (result.isError) {
      return {
        videoFilePath: "",
        season,
        episode,
        message: result.content[0]?.text || "Unknown error"
      };
    }

    const content = result.structuredContent as { videoFilePath: string; season: number; episode: number; message: string };
    return {
      videoFilePath: content.videoFilePath || "",
      season: content.season ?? season,
      episode: content.episode ?? episode,
      message: content.message || "Unknown error"
    };
  },
});
