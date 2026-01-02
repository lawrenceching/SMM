import { z } from 'zod';
import { Path } from '@core/path';
import type { MediaFileMetadata, MediaMetadata } from '@core/types';
import { metadataCacheFilePath, mediaMetadataDir } from '../route/mediaMetadata/utils';
import { mkdir } from 'fs/promises';
import { acknowledge, broadcast } from '../utils/socketIO';
import { listFiles } from '../utils/files';
import pino from 'pino';

const logger = pino();

interface MatchFile {
  season: number;
  episode: number;
  path: string;
}

function updateMediaFileMetadatas(
  mediaFiles: MediaFileMetadata[],
  videoFilePath: string,
  seasonNumber: number,
  episodeNumber: number
): MediaFileMetadata[] {
  // Check if videoFilePath already exists
  const existingIndex = mediaFiles.findIndex(file => file.absolutePath === videoFilePath);

  if (existingIndex !== -1) {
    // Update existing entry
    const existingFile = mediaFiles[existingIndex]!;
    logger.info(`Update media file "${videoFilePath}" from season ${existingFile.seasonNumber ?? '?'} episode ${existingFile.episodeNumber ?? '?'} to season ${seasonNumber} episode ${episodeNumber}`);
    const updatedFiles = [...mediaFiles];
    updatedFiles[existingIndex] = {
      ...updatedFiles[existingIndex]!,
      seasonNumber,
      episodeNumber
    };
    return updatedFiles;
  } else {
    // Add new entry
    logger.info(`Add media file "${videoFilePath}" season ${seasonNumber} episode ${episodeNumber}`);
    return [
      ...mediaFiles,
      {
        absolutePath: videoFilePath,
        seasonNumber,
        episodeNumber
      }
    ];
  }
}

export const createMatchEpisodesInBatchTool = (clientId: string, abortSignal?: AbortSignal) => ({
  description: `Match multiple local files to episodes of a TV show in batch.
This tool accepts an array of files to match and will ask for user confirmation before updating.
Once confirmed, it will update all the files in the media metadata.

Example: Match multiple files in folder "/path/to/media/folder" to various episodes.
This tool return JSON response with the following format:
\`\`\`typescript
interface ToolResponse {
    // error message
    error?: string;
}
\`\`\`
`,
  inputSchema: z.object({
    folderPath: z.string().describe("The absolute path of the media folder, it can be POSIX format or Windows format"),
    files: z.array(z.object({
      season: z.number().describe("The season number"),
      episode: z.number().describe("The episode number"),
      path: z.string().describe("The absolute path of the video file, it can be POSIX format or Windows format"),
    })).describe("Array of files to match"),
  }),
  execute: async ({ folderPath, files }: {
    folderPath: string;
    files: MatchFile[];
  }) => {
    // TODO: Implement abort handling - check abortSignal and cancel ongoing operations
    if (abortSignal?.aborted) {
      throw new Error('Request was aborted');
    }
    logger.info(`[tool][matchEpisodesInBatch] Matching ${files.length} files in folder "${folderPath}"`);
    const folderPathInPosix = Path.posix(folderPath);

    // 1. Read media metadata from cache file
    const metadataFilePath = metadataCacheFilePath(folderPathInPosix);
    const metadataExists = await Bun.file(metadataFilePath).exists();

    if (!metadataExists) {
      return { error: `Error Reason: folderPath "${folderPathInPosix}" is not opened in SMM` };
    }

    let mediaMetadata: MediaMetadata;
    try {
      mediaMetadata = await Bun.file(metadataFilePath).json() as MediaMetadata;
    } catch (error) {
      return { error: `Error Reason: Failed to read media metadata: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }

    // 2. Check if folderPathInPosix matches
    if (mediaMetadata.mediaFolderPath !== folderPathInPosix) {
      return { error: `Error Reason: folderPath "${folderPathInPosix}" does not match metadata folder path "${mediaMetadata.mediaFolderPath}"` };
    }

    // 3. Validate all files before asking for confirmation
    const tmdbTvShow = mediaMetadata.tmdbTvShow;
    if (!tmdbTvShow) {
      return { error: `Error Reason: TMDB TV show data is not available for this media folder` };
    }

    // List files from filesystem instead of using mediaMetadata.files
    const folderPathObj = new Path(folderPathInPosix);
    let filesystemFiles: string[];
    try {
      filesystemFiles = await listFiles(folderPathObj, true);
      logger.info({
        folderPath: folderPathInPosix,
        filesystemFilesCount: filesystemFiles.length
      }, '[tool][matchEpisodesInBatch] Listed files from filesystem');
    } catch (error) {
      logger.error({
        folderPath: folderPathInPosix,
        error: error instanceof Error ? error.message : String(error)
      }, '[tool][matchEpisodesInBatch] Failed to list files from filesystem');
      return { error: `Error Reason: Failed to list files from folder: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }

    const validationErrors: string[] = [];
    const validatedFiles: MatchFile[] = [];

    logger.info({
      folderPath: folderPathInPosix,
      totalFiles: files.length,
      filesystemFilesCount: filesystemFiles.length
    }, '[tool][matchEpisodesInBatch] Starting validation');

    for (const file of files) {
      // Normalize the input path to POSIX format
      const pathInPosix = Path.posix(file.path);
      
      logger.debug({
        originalPath: file.path,
        normalizedPath: pathInPosix,
        season: file.season,
        episode: file.episode
      }, '[tool][matchEpisodesInBatch] Validating file');
      
      // Check if path exists in filesystem files
      // Normalize filesystem files for comparison to handle any edge cases
      const fileExists = filesystemFiles.some(f => {
        const normalizedFile = Path.posix(f);
        return normalizedFile === pathInPosix || f === pathInPosix;
      });
      
      if (!fileExists) {
        logger.warn({
          path: pathInPosix,
          totalFilesInMediaFolder: filesystemFiles.length,
          sampleFiles: filesystemFiles.slice(0, 3)
        }, '[tool][matchEpisodesInBatch] File not found in media folder');
        validationErrors.push(`Path "${pathInPosix}" is not a file in the media folder`);
        continue;
      }

      logger.debug({
        path: pathInPosix,
        season: file.season,
        episode: file.episode
      }, '[tool][matchEpisodesInBatch] File exists, validating season/episode');

      // Check season and episode validity
      const season = tmdbTvShow.seasons?.find(s => s.season_number === file.season);
      if (!season) {
        logger.warn({
          path: pathInPosix,
          season: file.season,
          availableSeasons: tmdbTvShow.seasons?.map(s => s.season_number) ?? []
        }, '[tool][matchEpisodesInBatch] Season not found in TMDB');
        validationErrors.push(`Season ${file.season} does not exist in TMDB TV show for file "${pathInPosix}"`);
        continue;
      }

      const episode = season.episodes?.find(e => e.episode_number === file.episode);
      if (!episode) {
        logger.warn({
          path: pathInPosix,
          season: file.season,
          episode: file.episode,
          availableEpisodes: season.episodes?.map(e => e.episode_number) ?? []
        }, '[tool][matchEpisodesInBatch] Episode not found in season');
        validationErrors.push(`Episode ${file.episode} does not exist in season ${file.season} for file "${pathInPosix}"`);
        continue;
      }

      logger.debug({
        path: pathInPosix,
        season: file.season,
        episode: file.episode,
        episodeName: episode.name
      }, '[tool][matchEpisodesInBatch] File validation passed');

      validatedFiles.push(file);
    }

    logger.info({
      totalFiles: files.length,
      validatedFiles: validatedFiles.length,
      validationErrors: validationErrors.length
    }, '[tool][matchEpisodesInBatch] Validation complete');

    // If there are validation errors, return them
    if (validationErrors.length > 0) {
      logger.error({
        validationErrors,
        totalErrors: validationErrors.length
      }, '[tool][matchEpisodesInBatch] Validation failed');
      return { error: `Error Reason: Validation failed:\n${validationErrors.join('\n')}` };
    }

    if (validatedFiles.length === 0) {
      logger.warn('[tool][matchEpisodesInBatch] No valid files to match');
      return { error: `Error Reason: No valid files to match` };
    }

    // TODO: Check abortSignal before asking for confirmation
    if (abortSignal?.aborted) {
      throw new Error('Request was aborted');
    }

    // 4. Ask for user confirmation
    const getFilename = (path: string) => {
      const pathInPosix = Path.posix(path);
      const parts = pathInPosix.split('/').filter(p => p);
      return parts[parts.length - 1] || pathInPosix;
    };
    
    const confirmationMessage = `Match ${validatedFiles.length} file(s) to episodes?\n\n${validatedFiles.map(f => `  • ${getFilename(f.path)} → S${f.season}E${f.episode}`).join('\n')}`;
    
    try {
      // TODO: Check abortSignal during acknowledgement wait
      const responseData = await acknowledge(
        {
          event: 'askForConfirmation',
          data: {
            message: confirmationMessage,
          },
          clientId: clientId,
        },
      );

      const confirmed = responseData?.confirmed ?? responseData?.response === 'yes';
      
      if (!confirmed) {
        return { error: 'User cancelled the operation' };
      }
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error)
      }, '[tool][matchEpisodesInBatch] Error getting confirmation');
      return { error: `Error Reason: Failed to get user confirmation: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }

    // TODO: Check abortSignal before updating metadata
    if (abortSignal?.aborted) {
      throw new Error('Request was aborted');
    }

    // 5. Update media metadata for all files
    let updatedMediaFiles = mediaMetadata.mediaFiles ?? [];

    for (const file of validatedFiles) {
      // TODO: Check abortSignal during loop iteration
      if (abortSignal?.aborted) {
        throw new Error('Request was aborted');
      }
      const pathInPosix = Path.posix(file.path);
      updatedMediaFiles = updateMediaFileMetadatas(updatedMediaFiles, pathInPosix, file.season, file.episode);
    }

    const updatedMediaMetadata: MediaMetadata = {
      ...mediaMetadata,
      mediaFiles: updatedMediaFiles
    };

    // 6. Write updated metadata back to file
    try {
      await mkdir(mediaMetadataDir, { recursive: true });
      await Bun.write(metadataFilePath, JSON.stringify(updatedMediaMetadata, null, 2));
      logger.info(`[tool][matchEpisodesInBatch] Successfully updated media metadata for ${validatedFiles.length} file(s) in folder "${folderPathInPosix}"`);
      
      // 7. Notify all connected clients via Socket.IO
      broadcast({
        event: 'mediaMetadataUpdated',
        data: {
          folderPath: folderPathInPosix
        }
      });
    } catch (error) {
      return { error: `Error Reason: Failed to write media metadata: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }

    return {
      error: undefined
    };
  },
});

