import { z } from 'zod';
import { executeGetSelectedMediaMetadataTask } from '../../tasks/GetSelectedMediaMetadataTask';
import type { MediaMetadata } from '@core/types';

export const createGetSelectedMediaMetadataTool = (clientId: string, abortSignal?: AbortSignal) => ({
  description: `Get the user selected folder(media) in SMM.
  This tool returns data:
  * The path of the selected folder
  * The type of the selected folder (TV Show, Movie, Music)
  * The TMDB ID of selected folder (if available)
  * The name of TV Show or Movie (only available for TV Show and Movie)
  `,
  inputSchema: z.object({}),
  outputSchema: z.object({
    mediaFolderPath: z.string().describe("The path of the selected folder"),
    type: z.enum(["tvshow", "movie", "music"]).describe("The type of the selected folder. Anime is a type of tvshow."),
    tmdbId: z.number().describe("The TMDB ID of selected folder"),
    name: z.string().describe("The name of TV Show or Movie"),
    
  }),
  execute: async () => {
    // TODO: Implement abort handling - check abortSignal and cancel ongoing operations
    if (abortSignal?.aborted) {
      throw new Error('Request was aborted');
    }
    console.log(`[tool][getSelectedMediaMetadata] clientId: ${clientId}`);
    
    // Use the clientId from the request body if available, otherwise use first connection as fallback
    const result = await executeGetSelectedMediaMetadataTask(clientId);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to get selected media metadata');
    }
    
    console.log(`[tool][getSelectedMediaMetadata] media metadata: ${result.data.mediaFolderPath}`);
    const mm = result.data as MediaMetadata;
    return {
      mediaFolderPath: mm.mediaFolderPath,
      type: mm.type,
      tmdbId: mm.tmdbTvShow?.id,
      name: mm.tmdbTvShow?.name,
    };
  },
});

