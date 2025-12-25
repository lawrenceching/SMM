import { z } from 'zod';
import { sendAndWaitForResponse } from '../utils/websocketManager';

export const createAskForConfirmationTool = (clientId: string) => ({
  description: `Ask user for confirmation. 
  This tool accepts "message" parameter which will be shown to user.
  This tool return "yes" and "no" according to user's confirmation`,
  inputSchema: z.object({
    message: z.string().describe("The confirmation message to show to the user"),
  }),
  execute: async ({ message }: { message: string }) => {
    console.log(`[tool][askForConfirmation] clientId: ${clientId}, message: ${message}`);
    
    try {
      // Send WebSocket event to frontend and wait for response
      const responseData = await sendAndWaitForResponse(
        {
          event: 'askForConfirmation',
          data: {
            message,
          },
        },
        'askForConfirmationResponse', // Wait for this event in response
        30000, // 30 second timeout
        clientId // Send to specific client
      );
      
      // Extract the response from the data
      const confirmed = responseData?.confirmed ?? responseData?.response === 'yes';
      const result = confirmed ? 'yes' : 'no';
      
      console.log(`[tool][askForConfirmation] User response: ${result}`);
      return result;
    } catch (error) {
      console.error('[tool][askForConfirmation] Error:', error);
      // On timeout or error, default to "no" for safety
      throw new Error(`Failed to get user confirmation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

