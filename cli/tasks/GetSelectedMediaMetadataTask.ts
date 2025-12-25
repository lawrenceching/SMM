import { sendAndWaitForResponse } from '../src/utils/websocketManager';

/**
 * Send "getSelectedMediaMetadata" Socket.IO event to frontend and wait for acknowledgement
 * The frontend will respond with acknowledgement containing selectedMediaMetadata data
 * @param clientId Optional clientId to identify the Socket.IO connection. If not provided, uses the first active connection.
 * @returns The selected media metadata or an error object
 */
export async function executeGetSelectedMediaMetadataTask(clientId?: string): Promise<{ 
  success: boolean; 
  data?: any;
  error?: string;
}> {
  try {
    // Send Socket.IO event to frontend and wait for acknowledgement
    const responseData = await sendAndWaitForResponse(
      {
        event: 'getSelectedMediaMetadata',
      },
      '', // responseEvent not needed with Socket.IO acknowledgements
      10000, // 10 second timeout
      clientId // Send to specific client, or undefined to use first connection
    );
    
    return {
      success: true,
      data: responseData?.selectedMediaMetadata || responseData,
    };
  } catch (error) {
    console.error('[GetSelectedMediaMetadataTask] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

