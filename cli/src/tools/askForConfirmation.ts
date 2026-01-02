import { z } from 'zod';
import { acknowledge } from '../utils/socketIO';
import pino from "pino"
const logger = pino()

export const createAskForConfirmationTool = (clientId: string) => ({
  description: `Ask user for confirmation. 
  This tool accepts "message" parameter which will be shown to user.
  This tool return "yes" and "no" according to user's confirmation`,
  toolName: 'askForConfirmation',
  inputSchema: z.object({
    message: z.string().describe("The confirmation message to show to the user"),
  }),
  execute: async ({ message }: { message: string }) => {
    logger.info(`[tool][askForConfirmation] clientId: ${clientId}, message: ${message}`);
    
    try {
      // Send Socket.IO event to frontend and wait for acknowledgement response
      const responseData = await sendAndWaitForResponse(
        {
          event: 'askForConfirmation',
          data: {
            message,
          },
        },
        '', // responseEvent not needed with Socket.IO acknowledgements
        30000, // 30 second timeout
        clientId // Send to specific client room
      );
      
      logger.info(`[tool][askForConfirmation] responseData: ${JSON.stringify(responseData)}`);
      
      // Extract the response from the acknowledgement data
      const confirmed = responseData?.confirmed ?? responseData?.response === 'yes';
      const result = confirmed ? 'yes' : 'no';
      
      console.log(`[tool][askForConfirmation] User response: ${result}`);
      return result;
    } catch (error) {
      console.error('[tool][askForConfirmation] Error:', error);
      // On timeout or error, throw error instead of defaulting to "no"
      throw new Error(`Failed to get user confirmation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});
