import { z } from 'zod';
import { Path } from '@core/path';
import type { MediaFileMetadata, MediaMetadata } from '@core/types';
import { metadataCacheFilePath, mediaMetadataDir } from '../route/mediaMetadata/utils';
import { mkdir } from 'fs/promises';
import { broadcastMessage } from '../utils/websocketManager';

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
    console.log(`Update media file "${videoFilePath}" from season ${existingFile.seasonNumber ?? '?'} episode ${existingFile.episodeNumber ?? '?'} to season ${seasonNumber} episode ${episodeNumber}`);
    const updatedFiles = [...mediaFiles];
    updatedFiles[existingIndex] = {
      ...updatedFiles[existingIndex]!,
      seasonNumber,
      episodeNumber
    };
    return updatedFiles;
  } else {
    // Add new entry
    console.log(`Add media file "${videoFilePath}" season ${seasonNumber} episode ${episodeNumber}`);
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

export const matchEpisodeTool = {
  description: `Match local file to episodes of a TV show.
For example, use this tool to indicate "/path/to/media/folder/Episode 1/file1.mp4" in folder "/path/to/media/folder" is for episode 1 of season 1.
This tool return JSON response with the following format:
\`\`\`typescript
interface ToolResponse {
    // error message
    error?: string;
}
\`\`\`

Please **ensure** you call "ask-for-confirmation" to get user confirmation before you call this tool.
`,
  inputSchema: z.object({
    folderPath: z.string().describe("The absolute path of the media folder, it can be POSIX format or Windows format"),
    path: z.string().describe("The absolute path of the video file, it can be POSIX format or Windows format"),
    seasonNumber: z.number().describe("The season number"),
    episodeNumber: z.number().describe("The episode number"),
  }),
  execute: async ({ folderPath, path, seasonNumber, episodeNumber }: {
    folderPath: string;
    path: string;
    seasonNumber: number;
    episodeNumber: number;
  }) => {
    console.log(`[tool][matchEpisode] Match episode ${seasonNumber} ${episodeNumber} in folder "${folderPath}" with file "${path}"`);
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

    // 3. Check if path is valid
    const pathInPosix = Path.posix(path);
    const files = mediaMetadata.files;
    if (!files || !files.includes(pathInPosix)) {
      return { error: `Error Reason: path "${pathInPosix}" is not a file in the media folder` };
    }

    // 4. Check episodeNumber and seasonNumber is valid
    const tmdbTvShow = mediaMetadata.tmdbTvShow;
    if (!tmdbTvShow) {
      return { error: `Error Reason: TMDB TV show data is not available for this media folder` };
    }

    const season = tmdbTvShow.seasons?.find(s => s.season_number === seasonNumber);
    if (!season) {
      return { error: `Error Reason: season ${seasonNumber} does not exist in TMDB TV show` };
    }

    const episode = season.episodes?.find(e => e.episode_number === episodeNumber);
    if (!episode) {
      return { error: `Error Reason: episode ${episodeNumber} does not exist in season ${seasonNumber}` };
    }

    // 5. Update media metadata
    const updatedMediaMetadata: MediaMetadata = {
      ...mediaMetadata,
      mediaFiles: updateMediaFileMetadatas(mediaMetadata.mediaFiles ?? [], pathInPosix, seasonNumber, episodeNumber)
    };

    // 6. Write updated metadata back to file
    try {
      await mkdir(mediaMetadataDir, { recursive: true });
      await Bun.write(metadataFilePath, JSON.stringify(updatedMediaMetadata, null, 2));
      console.log(`[tool][matchEpisode] Successfully updated media metadata for folder "${folderPathInPosix}"`);
      
      // 7. Notify all connected clients via WebSocket
      broadcastMessage({
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
};

