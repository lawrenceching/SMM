import { z } from 'zod';
import { mockMediaMetadata } from '@/utils/mock';
// import { executeGetSelectedMediaMetadataTask } from '../../tasks/GetSelectedMediaMetadataTask';

export const createGetSelectedMediaMetadataTool = (clientId: string) => ({
  description: `Get the user selected folder(media) in SMM.
  This tool returns data:
  * The path of the selected folder
  * The type of the selected folder (TV Show, Movie, Music)
  * The TMDB ID of selected folder (if available)
  * The name of TV Show or Movie (only available for TV Show and Movie)
  `,
  inputSchema: z.object({}),
  execute: async () => {
    console.log(`[tool][getSelectedMediaMetadata] clientId: ${clientId}`);
    return {
      mediaFolderPath: mockMediaMetadata.mediaFolderPath,
      type: mockMediaMetadata.type,
      tmdbId: mockMediaMetadata.tmdbTvShow?.id,
      name: mockMediaMetadata.tmdbTvShow?.name,
    };
    // Use the clientId from the request body if available, otherwise use first connection as fallback
    // const result = await executeGetSelectedMediaMetadataTask(clientId);
    
    // if (!result.success) {
    //   throw new Error(result.error || 'Failed to get selected media metadata');
    // }
    
    // console.log(`[tool][getSelectedMediaMetadata] media metadata: ${result.data.mediaFolderPath}`);
    // return result.data;
  },
});

