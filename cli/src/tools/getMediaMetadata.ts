import { z } from 'zod';
import { Path } from '@core/path';
import { stat } from 'node:fs/promises';
import type { MediaMetadata } from '@core/types';
import { metadataCacheFilePath } from '../route/mediaMetadata/utils';

export interface GetMediaMetadataResponse {
  status: "success" | "failure";
  message: string;
  data?: {
    mediaFolderPath: string;
    type: "tvshow" | "movie" | "music";
    tmdbId: number;
    name: string;
    seasons: Array<{
      seasonNumber: number;
      seasonName: string;
      episodes: Array<{
        episodeNumber: number;
        episodeName: string;
      }>;
    }>;
  };
}

export const createGetMediaMetadataTool = (clientId: string) => ({
  description: `Get Media Metadata for a media folder. 
  If the tool return "media metadata not found", it means SMM don't know what TV show or Movie is for this media folder.
  `,
  inputSchema: z.object({
    mediaFolderPath: z.string().describe("The path of the media folder that to query media metadata"),
  }),
  outputSchema: z.object({
    status: z.enum(["success", "failure"]).describe("The status of the operation"),
    message: z.string().describe("The message of the operation"),
    data: z.object({
      mediaFolderPath: z.string().describe("The path of the selected folder"),
      type: z.enum(["tvshow", "movie", "music"]).describe("The type of the selected folder. Anime is a type of tvshow."),
      tmdbId: z.number().describe("The TMDB ID of selected folder"),
      name: z.string().describe("The name of TV Show or Movie"),
      seasons: z.array(z.object({
        seasonNumber: z.number().describe("The season number"),
        seasonName: z.string().describe("The season name"),
        episodes: z.array(z.object({
          episodeNumber: z.number().describe("The episode number"),
          episodeName: z.string().describe("The episode name"),
        })),
      })),
    }).optional(),
  }),
  execute: async ({ mediaFolderPath }: { mediaFolderPath: string }) => {
    console.log(`[tool][getMediaMetadata] mediaFolderPath: ${mediaFolderPath}`);
    
    // Check if folder exists
    try {
      const stats = await stat(mediaFolderPath);
      if (!stats.isDirectory()) {
        return {
          status: "failure",
          message: `Folder Not Found: ${mediaFolderPath} is not a directory`,
        } as GetMediaMetadataResponse;
      }
    } catch (error) {
      return {
        status: "failure",
        message: `Folder Not Found: ${mediaFolderPath} was not found`,
      } as GetMediaMetadataResponse;
    }

    // Check if metadata cache file exists
    const folderPathInPosix = Path.posix(mediaFolderPath);
    const metadataFilePath = metadataCacheFilePath(folderPathInPosix);
    const isExist = await Bun.file(metadataFilePath).exists();
    
    if (!isExist) {
      console.log(`[tool][getMediaMetadata] Media Metadata Not Found: ${metadataFilePath} was not found`);
      return {
        status: "success",
        message: `SMM don't know what TV show or Movie is for this media folder. Notify user "请搜索和匹配电视剧/动画以识别该文件夹"`,
      } as GetMediaMetadataResponse;
    }

    // Read metadata from cache file
    let mm: MediaMetadata;
    try {
      console.log(`[tool][getMediaMetadata] Reading metadata from file: ${metadataFilePath}`);
      mm = await Bun.file(metadataFilePath).json() as MediaMetadata;
    } catch (error) {
      console.error(`[tool][getMediaMetadata] Error reading metadata from file: ${metadataFilePath}`, error);
      return {
        status: "failure",
        message: `Failed to read media metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
      } as GetMediaMetadataResponse;
    }

    // Check if tmdbTvShow exists
    if (mm.tmdbTvShow === undefined || mm.tmdbTvShow.id === undefined) {
      return {
        status: "success",
        message: `SMM don't know what TV show or Movie is for this media folder. Notify user "请搜索和匹配电视剧/动画以识别该文件夹"`,
      } as GetMediaMetadataResponse;
    }

    console.log(`[tool][getMediaMetadata] media metadata: ${mm.mediaFolderPath}`);
    
    // Map type from "tvshow-folder" | "movie-folder" | "music-folder" to "tvshow" | "movie" | "music"
    const typeMap: Record<string, "tvshow" | "movie" | "music"> = {
      "tvshow-folder": "tvshow",
      "movie-folder": "movie",
      "music-folder": "music",
    };
    const mappedType = mm.type ? typeMap[mm.type] || "tvshow" : "tvshow";
    
    // Build seasons array from tmdbTvShow.seasons
    const seasons = mm.tmdbTvShow?.seasons?.map((season) => ({
      seasonNumber: season.season_number,
      seasonName: season.name || `Season ${season.season_number}`,
      episodes: (season.episodes || []).map((episode) => ({
        episodeNumber: episode.episode_number,
        episodeName: episode.name || `Episode ${episode.episode_number}`,
      })),
    })) || [];
    
    return {
      status: "success",
      message: "Media metadata retrieved successfully",
      data: {
        mediaFolderPath: mm.mediaFolderPath || "",
        type: mappedType,
        tmdbId: mm.tmdbTvShow.id,
        name: mm.tmdbTvShow.name || "",
        seasons,
      },
    } as GetMediaMetadataResponse;
  },
});

