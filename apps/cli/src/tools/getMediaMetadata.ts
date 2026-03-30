import { stat } from "node:fs/promises";
import { Path } from "@core/path";
import type {
  MediaMetadata,
  MovieMediaMetadata,
  TMDBMovie,
  TMDBTVShowDetails,
  TvShowMediaMetadata,
} from "@core/types";
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

/** TMDB-shaped TV show block in MCP responses */
export interface GetMediaMetadataResponseTvShowData {
  source: "TMDB" | "TVDB";
  id: number;
  name: string;
  seasons: GetMediaMetadataResponseTvShowSeasonData[];
}

/** TMDB movie subset for MCP */
export interface GetMediaMetadataResponseTmdbMovieData {
  tmdbId: number;
  title: string;
  originalTitle: string;
  overview: string;
  releaseDate: string;
  posterPath: string | null;
}

/** TVDB movie subset for MCP */
export interface GetMediaMetadataResponseTvdbMovieData {
  tvdbId: number;
  name: string;
  database: "TMDB" | "TVDB";
}

export interface GetMediaMetadataResponseData {
  mediaFolderPath: string;
  type: "tvshow-folder" | "movie-folder" | "music-folder";
  tvShow?: GetMediaMetadataResponseTvShowData | string;
  tmdbMovie?: GetMediaMetadataResponseTmdbMovieData | string;
  tvdbMovie?: GetMediaMetadataResponseTvdbMovieData | string;
}

const MSG_UNRECOGNIZED_MEDIA =
  "SMM未识别本文件夹, 请提示用户从SMM界面中搜索并匹配媒体";

function parseTvdbIdString(id: string): number {
  const n = Number.parseInt(id, 10);
  return Number.isFinite(n) ? n : 0;
}

function mapTmdbTvShowDetailsToResponse(
  tmdbTvShow: TMDBTVShowDetails
): GetMediaMetadataResponseTvShowData {
  return {
    source: "TMDB",
    id: tmdbTvShow.id,
    name: tmdbTvShow.name,
    seasons:
      tmdbTvShow.seasons?.map((season) => ({
        seasonNumber: season.season_number,
        seasonName: season.name,
        episodes:
          season.episodes?.map((episode) => ({
            seasonNumber: episode.season_number,
            episodeNumber: episode.episode_number,
            episodeName: episode.name,
          })) ?? [],
      })) ?? [],
  };
}

function mapTvdbTvShowToResponse(
  tv: TvShowMediaMetadata
): GetMediaMetadataResponseTvShowData {
  return {
    source: "TVDB",
    id: parseTvdbIdString(tv.id),
    name: tv.name,
    seasons:
      tv.seasons?.map((season) => ({
        seasonNumber: season.season,
        seasonName: season.name,
        episodes:
          season.episodes?.map((ep) => ({
            seasonNumber: ep.season,
            episodeNumber: ep.episode,
            episodeName: ep.name,
          })) ?? [],
      })) ?? [],
  };
}

function mapTmdbMovieToResponse(m: TMDBMovie): GetMediaMetadataResponseTmdbMovieData {
  return {
    tmdbId: m.id,
    title: m.title,
    originalTitle: m.original_title,
    overview: m.overview,
    releaseDate: m.release_date,
    posterPath: m.poster_path,
  };
}

function mapTvdbMovieToResponse(m: MovieMediaMetadata): GetMediaMetadataResponseTvdbMovieData {
  return {
    tvdbId: parseTvdbIdString(m.id),
    name: m.name,
    database: m.database,
  };
}

/**
 * Build MCP `data` payload from cached {@link MediaMetadata}.
 */
export function fillMediaMetadataResponseData(
  metadata: MediaMetadata,
  posixPath: string
): GetMediaMetadataResponseData {
  const data: GetMediaMetadataResponseData = {
    mediaFolderPath: Path.toPlatformPath(metadata.mediaFolderPath || posixPath),
    type: metadata.type || "tvshow-folder",
  };

  if (data.type === "tvshow-folder") {
    if (metadata.tvdbTvShow) {
      data.tvShow = mapTvdbTvShowToResponse(metadata.tvdbTvShow);
    } else if (metadata.tmdbTvShow) {
      data.tvShow = mapTmdbTvShowDetailsToResponse(metadata.tmdbTvShow);
    } else {
      data.tvShow = MSG_UNRECOGNIZED_MEDIA;
    }
  } else if (data.type === "movie-folder") {
    if (metadata.tmdbMovie) {
      data.tmdbMovie = mapTmdbMovieToResponse(metadata.tmdbMovie);
    } else {
      data.tmdbMovie = MSG_UNRECOGNIZED_MEDIA;
    }
    if (metadata.tvdbMovie) {
      data.tvdbMovie = mapTvdbMovieToResponse(metadata.tvdbMovie);
    } else {
      data.tvdbMovie = MSG_UNRECOGNIZED_MEDIA;
    }
  }

  return data;
}

const seasonEpisodeSchema = z.object({
  seasonNumber: z.number(),
  seasonName: z.string(),
  episodes: z.array(
    z.object({
      seasonNumber: z.number(),
      episodeNumber: z.number(),
      episodeName: z.string(),
    })
  ),
});

const getMediaMetadataDataOutputSchema = z.object({
  mediaFolderPath: z.string().describe("The path of the media folder"),
  type: z
    .enum(["tvshow-folder", "movie-folder", "music-folder"])
    .describe("The type of the media folder"),
  tvShow: z
    .union([
      z.object({
        source: z.enum(["TMDB", "TVDB"]),
        id: z.number(),
        name: z.string(),
        seasons: z.array(seasonEpisodeSchema),
      }),
      z.string(),
    ])
    .optional()
    .describe("Normalized TV show data or message if not recognized"),
  tmdbMovie: z
    .union([
      z.object({
        tmdbId: z.number(),
        title: z.string(),
        originalTitle: z.string(),
        overview: z.string(),
        releaseDate: z.string(),
        posterPath: z.string().nullable(),
      }),
      z.string(),
    ])
    .optional()
    .describe("TMDB movie data or message if not recognized"),
  tvdbMovie: z
    .union([
      z.object({
        tvdbId: z.number().describe("TheTVDB movie ID"),
        name: z.string(),
        database: z.enum(["TMDB", "TVDB"]),
      }),
      z.string(),
    ])
    .optional()
    .describe("TVDB movie data or message if not recognized"),
});

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

    const data = fillMediaMetadataResponseData(metadata, posixPath);
    return createSuccessResponse({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return createErrorResponse(`Error reading media metadata: ${message}`);
  }
}

export const getTool = async function (abortSignal?: AbortSignal): Promise<ToolDefinition> {
  const description = await getLocalizedToolDescription("get-media-metadata");

  return {
    toolName: "get-media-metadata",
    description: description,
    inputSchema: z.object({
      mediaFolderPath: z.string().describe("The absolute path of the media folder"),
    }),
    outputSchema: z.object({
      data: getMediaMetadataDataOutputSchema.describe("Media metadata response data"),
      error: z.string().optional().describe("Error message if not found"),
    }),
    execute: async (args: { mediaFolderPath: string }) => {
      return handleGetMediaMetadata(args, abortSignal);
    },
  };
};

/**
 * Returns a tool definition for AI agent usage.
 */
export function getMediaMetadataAgentTool(clientId: string, abortSignal?: AbortSignal) {
  return {
    description:
      "Get cached media metadata for a folder, including normalized TV show data and TMDB/TVDB movie information when available.",
    inputSchema: z.object({
      mediaFolderPath: z.string().describe("The absolute path of the media folder"),
    }),
    outputSchema: z.object({
      mediaFolderPath: z.string(),
      type: z.string(),
      tvShow: z.any().optional(),
      tmdbMovie: z.any().optional(),
      tvdbMovie: z.any().optional(),
      error: z.string().optional(),
    }),
    execute: async ({ mediaFolderPath }: { mediaFolderPath: string }) => {
      if (abortSignal?.aborted) {
        throw new Error("Request was aborted");
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

        const data = fillMediaMetadataResponseData(metadata, posixPath);
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
 */
export async function getMediaMetadataMcpTool() {
  return getTool();
}
