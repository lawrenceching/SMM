import { stat } from "node:fs/promises";
import { Path } from "@core/path";
import { findMediaMetadata } from "@/utils/mediaMetadata";
import type { McpToolResponse } from "./mcpToolBase";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export interface GetEpisodesParams {
  mediaFolderPath: string;
}

const MSG_FOLDER_NOT_FOUND = "Folder Not Found";
const MSG_UNKNOWN_TV_SHOW = "SMM don't know the TV show info";

/**
 * Get all episodes for a TV show media folder.
 * Returns a flat array of all episodes across all seasons.
 */
export async function handleGetEpisodes(params: GetEpisodesParams): Promise<McpToolResponse> {
  const { mediaFolderPath } = params;

  if (!mediaFolderPath || typeof mediaFolderPath !== "string" || mediaFolderPath.trim() === "") {
    return {
      content: [{ type: "text" as const, text: "Invalid path: mediaFolderPath must be a non-empty string" }],
      isError: true,
    };
  }

  try {
    // Convert to platform-specific path for file system operations
    const platformPath = Path.toPlatformPath(mediaFolderPath);

    // Check if folder exists
    try {
      const stats = await stat(platformPath);
      if (!stats.isDirectory()) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ status: "failure", message: `${MSG_FOLDER_NOT_FOUND}: ${mediaFolderPath} is not a directory` }) }],
        };
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ status: "failure", message: `${MSG_FOLDER_NOT_FOUND}: ${mediaFolderPath} was not found` }) }],
        };
      }
      throw error;
    }

    // Convert to POSIX path for findMediaMetadata
    const posixPath = Path.posix(mediaFolderPath);

    // Find media metadata
    const metadata = await findMediaMetadata(posixPath);

    if (!metadata) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ status: "failure", message: MSG_UNKNOWN_TV_SHOW }) }],
      };
    }

    // Check if tmdbTvShow exists and has seasons
    if (!metadata.tmdbTvShow || !metadata.tmdbTvShow.id || !metadata.tmdbTvShow.seasons) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ status: "failure", message: MSG_UNKNOWN_TV_SHOW }) }],
      };
    }

    // Extract all episodes from all seasons into a flat array
    const episodes: { seasonNumber: number; episodeNumber: number; title: string }[] = [];

    for (const season of metadata.tmdbTvShow.seasons) {
      if (season.episodes && Array.isArray(season.episodes)) {
        for (const episode of season.episodes) {
          episodes.push({
            seasonNumber: season.season_number,
            episodeNumber: episode.episode_number,
            title: episode.name || `Episode ${episode.episode_number}`,
          });
        }
      }
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ status: "success", episodes, count: episodes.length }) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text" as const, text: `Error getting episodes: ${message}` }],
      isError: true,
    };
  }
}

/**
 * Register the get-episodes tool with the MCP server.
 */
export function registerGetEpisodesTool(server: McpServer): void {
  server.registerTool(
    "get-episodes",
    {
      description: "Get all episodes for a TV show media folder. Returns a flat array of all episodes across all seasons.",
      inputSchema: {
        type: "object",
        properties: {
          mediaFolderPath: {
            type: "string",
            description: "The absolute path of the TV show media folder",
          },
        },
        required: ["mediaFolderPath"],
      },
    } as any,
    async (args: GetEpisodesParams) => {
      return handleGetEpisodes(args);
    }
  );
}
