import { z } from 'zod/v3';
import { stat } from 'node:fs/promises';
import { Path } from '@core/path';
import { findMediaMetadata } from '../utils/mediaMetadata';
import type { GetEpisodesToolResponse } from '@core/types/GetEpisodesToolTypes';
import { MSG_FOLDER_NOT_FOUND, MSG_UNKNOWN_TV_SHOW } from '@core/types/GetEpisodesToolTypes';

export const createGetEpisodesTool = (clientId: string, abortSignal?: AbortSignal) => ({
  description: `Get all episodes for a TV show media folder. Returns a flat array of all episodes across all seasons.
  If the tool returns "Folder Not Found", the media folder path doesn't exist.
  If the tool returns "SMM don't know the TV show info", ask user to search and match the TV show first.
  `,
  inputSchema: z.object({
    mediaFolderPath: z.string().describe("The absolute path of the media folder in platform-specific format"),
  }),
  outputSchema: z.object({
    status: z.enum(["success", "failure"]).describe("The status of the operation"),
    message: z.string().optional().describe("The message of the operation"),
    episodes: z.array(z.object({
      seasonNumber: z.number().describe("The season number"),
      episodeNumber: z.number().describe("The episode number"),
      title: z.string().describe("The title of the episode"),
    })).optional().describe("Array of all episodes across all seasons"),
  }),
  execute: async ({ mediaFolderPath }: { mediaFolderPath: string }) => {
    if (abortSignal?.aborted) {
      throw new Error('Request was aborted');
    }
    console.log(`[tool][getEpisodes] mediaFolderPath: ${mediaFolderPath}`);
    
    // Convert to platform-specific path for file system operations
    const platformPath = Path.toPlatformPath(mediaFolderPath);
    
    // Check if folder exists
    try {
      const stats = await stat(platformPath);
      if (!stats.isDirectory()) {
        return {
          status: "failure",
          message: `${MSG_FOLDER_NOT_FOUND}: ${mediaFolderPath} is not a directory`,
        } as GetEpisodesToolResponse;
      }
    } catch (error) {
      return {
        status: "failure",
        message: `${MSG_FOLDER_NOT_FOUND}: ${mediaFolderPath} was not found`,
      } as GetEpisodesToolResponse;
    }

    // Convert to POSIX path for findMediaMetadata (it expects POSIX format internally)
    const posixPath = Path.posix(mediaFolderPath);
    
    // Find media metadata
    const metadata = await findMediaMetadata(posixPath);
    
    if (!metadata) {
      console.log(`[tool][getEpisodes] Media Metadata Not Found for: ${mediaFolderPath}`);
      return {
        status: "failure",
        message: MSG_UNKNOWN_TV_SHOW,
      } as GetEpisodesToolResponse;
    }

    // Check if tmdbTvShow exists and has seasons
    if (!metadata.tmdbTvShow || !metadata.tmdbTvShow.id || !metadata.tmdbTvShow.seasons) {
      console.log(`[tool][getEpisodes] TV Show info not found in metadata for: ${mediaFolderPath}`);
      return {
        status: "failure",
        message: MSG_UNKNOWN_TV_SHOW,
      } as GetEpisodesToolResponse;
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

    console.log(`[tool][getEpisodes] Found ${episodes.length} episodes for: ${mediaFolderPath}`);
    
    return {
      status: "success",
      episodes,
    } as GetEpisodesToolResponse;
  },
});
