import { acknowledge } from '@/utils/socketIO';
import { z } from 'zod';

export const getApplicationContextTool = (clientId: string, abortSignal?: AbortSignal) => ({
    description: `The the application context including:
    1. what media folder user selected 
`,
    inputSchema: z.object({}),
    outputSchema: z.object({
      selectedFolderPath: z.string().describe("The path of the media folder that user selected in UI."),
    }),
    execute: async ({ path }: { path: string }) => {
        // TODO: Implement abort handling - check abortSignal and cancel ongoing operations
        if (abortSignal?.aborted) {
            throw new Error('Request was aborted');
        }
        try {
            // Send Socket.IO event to frontend and wait for acknowledgement
            const responseData = await acknowledge(
              {
                event: 'getSelectedMediaMetadata',
                clientId: clientId,
              },
            );
            
            return {
                selectedFolderPath: responseData?.selectedMediaMetadata?.mediaFolderPath,
            };
          } catch (error) {
            console.error('[GetSelectedMediaMetadataTask] Error:', error);
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
    },
  });
  