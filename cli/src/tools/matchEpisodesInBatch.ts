import { z } from 'zod/v3';
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

interface ValidationResult {
  isValid: boolean;
  error?: string;
}

interface FileValidationResult {
  isValid: boolean;
  error?: string;
  validatedFile?: MatchFile;
}

export function updateMediaFileMetadatas(
  _mediaFiles: MediaFileMetadata[],
  videoFilePath: string,
  seasonNumber: number,
  episodeNumber: number
): MediaFileMetadata[] {

  let mediaFiles = _mediaFiles;

  // remove all media files for given season and episode
  mediaFiles = mediaFiles.filter(file => file.seasonNumber !== seasonNumber || file.episodeNumber !== episodeNumber);

  // remove all media files for given path
  mediaFiles = mediaFiles.filter(file => file.absolutePath !== videoFilePath);

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

/**
 * Validates that the metadata file exists
 */
export async function validateMetadataExists(folderPath: string): Promise<ValidationResult> {
  const folderPathInPosix = Path.posix(folderPath);
  const metadataFilePath = metadataCacheFilePath(folderPathInPosix);
  const metadataExists = await Bun.file(metadataFilePath).exists();

  if (!metadataExists) {
    return {
      isValid: false,
      error: `Error Reason: folderPath "${folderPathInPosix}" is not opened in SMM`
    };
  }

  return { isValid: true };
}

/**
 * Validates and loads media metadata from cache file
 */
export async function validateAndLoadMetadata(folderPath: string): Promise<ValidationResult & { metadata?: MediaMetadata }> {
  const folderPathInPosix = Path.posix(folderPath);
  const metadataFilePath = metadataCacheFilePath(folderPathInPosix);

  try {
    const metadata = await Bun.file(metadataFilePath).json() as MediaMetadata;
    return { isValid: true, metadata };
  } catch (error) {
    return {
      isValid: false,
      error: `Error Reason: Failed to read media metadata: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Validates that the folder path matches the metadata folder path
 */
export function validateFolderPathMatch(folderPath: string, mediaMetadata: MediaMetadata): ValidationResult {
  const folderPathInPosix = Path.posix(folderPath);

  if (mediaMetadata.mediaFolderPath !== folderPathInPosix) {
    return {
      isValid: false,
      error: `Error Reason: folderPath "${folderPathInPosix}" does not match metadata folder path "${mediaMetadata.mediaFolderPath}"`
    };
  }

  return { isValid: true };
}

/**
 * Validates that TMDB TV show data exists in metadata
 */
export function validateTmdbTvShowExists(mediaMetadata: MediaMetadata): ValidationResult {
  if (!mediaMetadata.tmdbTvShow) {
    return {
      isValid: false,
      error: `Error Reason: TMDB TV show data is not available for this media folder`
    };
  }

  return { isValid: true };
}

/**
 * Validates that a file exists in the filesystem
 */
export function validateFileExists(filePath: string, filesystemFiles: string[]): ValidationResult {
  const pathInPosix = Path.posix(filePath);
  
  const fileExists = filesystemFiles.some(f => {
    const normalizedFile = Path.posix(f);
    logger.info({
      normalizedFile,
      pathInPosix,
      f,
    })
    return normalizedFile === pathInPosix || f === pathInPosix;
  });


  if (!fileExists) {
    return {
      isValid: false,
      error: `Path "${pathInPosix}" is not a file in the media folder`
    };
  }

  return { isValid: true };
}

/**
 * Validates that a season exists in TMDB TV show data
 */
export function validateSeasonExists(
  seasonNumber: number,
  tmdbTvShow: NonNullable<MediaMetadata['tmdbTvShow']>,
  filePath: string
): ValidationResult {
  const season = tmdbTvShow.seasons?.find(s => s.season_number === seasonNumber);
  
  if (!season) {
    return {
      isValid: false,
      error: `Season ${seasonNumber} does not exist in TMDB TV show for file "${Path.posix(filePath)}"`
    };
  }

  return { isValid: true };
}

/**
 * Validates that an episode exists in a season
 */
export function validateEpisodeExists(
  seasonNumber: number,
  episodeNumber: number,
  tmdbTvShow: NonNullable<MediaMetadata['tmdbTvShow']>,
  filePath: string
): ValidationResult {
  const season = tmdbTvShow.seasons?.find(s => s.season_number === seasonNumber);
  
  if (!season) {
    return {
      isValid: false,
      error: `Season ${seasonNumber} does not exist in TMDB TV show for file "${Path.posix(filePath)}"`
    };
  }

  const episode = season.episodes?.find(e => e.episode_number === episodeNumber);
  
  if (!episode) {
    return {
      isValid: false,
      error: `Episode ${episodeNumber} does not exist in season ${seasonNumber} for file "${Path.posix(filePath)}"`
    };
  }

  return { isValid: true };
}

/**
 * Validates a single file against filesystem and TMDB data
 */
export function validateFile(
  file: MatchFile,
  filesystemFiles: string[],
  tmdbTvShow: NonNullable<MediaMetadata['tmdbTvShow']>
): FileValidationResult {
  const pathInPosix = Path.posix(file.path);

  // Validate file exists in filesystem
  const fileExistsResult = validateFileExists(file.path, filesystemFiles);
  if (!fileExistsResult.isValid) {
    logger.warn({
      path: pathInPosix,
      totalFilesInMediaFolder: filesystemFiles.length,
      sampleFiles: filesystemFiles.slice(0, 3)
    }, '[tool][matchEpisodesInBatch] File not found in media folder');
    return { isValid: false, error: fileExistsResult.error };
  }

  // Validate season exists
  const seasonResult = validateSeasonExists(file.season, tmdbTvShow, file.path);
  if (!seasonResult.isValid) {
    logger.warn({
      path: pathInPosix,
      season: file.season,
      availableSeasons: tmdbTvShow.seasons?.map(s => s.season_number) ?? []
    }, '[tool][matchEpisodesInBatch] Season not found in TMDB');
    return { isValid: false, error: seasonResult.error };
  }

  // Validate episode exists
  const episodeResult = validateEpisodeExists(file.season, file.episode, tmdbTvShow, file.path);
  if (!episodeResult.isValid) {
    const season = tmdbTvShow.seasons?.find(s => s.season_number === file.season);
    logger.warn({
      path: pathInPosix,
      season: file.season,
      episode: file.episode,
      availableEpisodes: season?.episodes?.map(e => e.episode_number) ?? []
    }, '[tool][matchEpisodesInBatch] Episode not found in season');
    return { isValid: false, error: episodeResult.error };
  }

  logger.debug({
    path: pathInPosix,
    season: file.season,
    episode: file.episode
  }, '[tool][matchEpisodesInBatch] File validation passed');

  return { isValid: true, validatedFile: file };
}

/**
 * Validates all files and returns validated files and errors
 */
export function validateAllFiles(
  files: MatchFile[],
  filesystemFiles: string[],
  tmdbTvShow: NonNullable<MediaMetadata['tmdbTvShow']>
): { validatedFiles: MatchFile[]; validationErrors: string[] } {
  const validationErrors: string[] = [];
  const validatedFiles: MatchFile[] = [];

  for (const file of files) {
    const pathInPosix = Path.posix(file.path);
    
    logger.debug({
      originalPath: file.path,
      normalizedPath: pathInPosix,
      season: file.season,
      episode: file.episode
    }, '[tool][matchEpisodesInBatch] Validating file');

    const result = validateFile(file, filesystemFiles, tmdbTvShow);
    
    if (!result.isValid) {
      validationErrors.push(result.error!);
      continue;
    }

    if (result.validatedFile) {
      validatedFiles.push(result.validatedFile);
    }
  }

  return { validatedFiles, validationErrors };
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
    const metadataFilePath = metadataCacheFilePath(folderPathInPosix);

    // 1. Validate metadata exists
    const metadataExistsResult = await validateMetadataExists(folderPath);
    if (!metadataExistsResult.isValid) {
      return { error: metadataExistsResult.error };
    }

    // 2. Validate and load media metadata
    const metadataLoadResult = await validateAndLoadMetadata(folderPath);
    if (!metadataLoadResult.isValid || !metadataLoadResult.metadata) {
      return { error: metadataLoadResult.error };
    }
    const mediaMetadata = metadataLoadResult.metadata;

    // 3. Validate folder path matches
    const folderPathMatchResult = validateFolderPathMatch(folderPath, mediaMetadata);
    if (!folderPathMatchResult.isValid) {
      return { error: folderPathMatchResult.error };
    }

    // 4. Validate TMDB TV show exists
    const tmdbTvShowResult = validateTmdbTvShowExists(mediaMetadata);
    if (!tmdbTvShowResult.isValid) {
      return { error: tmdbTvShowResult.error };
    }
    const tmdbTvShow = mediaMetadata.tmdbTvShow!;

    // 5. List files from filesystem
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

    // 6. Validate all files
    logger.info({
      folderPath: folderPathInPosix,
      totalFiles: files.length,
      filesystemFilesCount: filesystemFiles.length
    }, '[tool][matchEpisodesInBatch] Starting validation');

    const { validatedFiles, validationErrors } = validateAllFiles(files, filesystemFiles, tmdbTvShow);

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


    // 4. Ask for user confirmation
    const getFilename = (path: string) => {
      const pathInPosix = Path.posix(path);
      const parts = pathInPosix.split('/').filter(p => p);
      return parts[parts.length - 1] || pathInPosix;
    };
    
    const confirmationMessage = `Match ${validatedFiles.length} file(s) to episodes?\n\n${validatedFiles.map(f => `  • ${getFilename(f.path)} → S${f.season}E${f.episode}`).join('\n')}`;
    
    try {
      
      logger.info({
        clientId,
        confirmationMessage,
      }, '[tool][matchEpisodesInBatch] Sending askForConfirmation event');
      const responseData = await acknowledge(
        {
          event: 'askForConfirmation',
          data: {
            message: confirmationMessage,
          },
          clientId: clientId,
        },
      );

      logger.info({
        responseData,
      }, '[tool][matchEpisodesInBatch] User confirmation received');

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

    // 5. Update media metadata for all files
    let updatedMediaFiles = mediaMetadata.mediaFiles ?? [];

    for (const file of validatedFiles) {
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

