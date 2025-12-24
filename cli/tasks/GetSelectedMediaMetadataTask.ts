import { sendAndWaitForResponse } from '../src/utils/websocketManager';

/**
 * Send "getSelectedMediaMetadata" WebSocket event to frontend and wait for response
 * The frontend will respond with "selectedMediaMetadata" event containing the data
 * @returns The selected media metadata or an error object
 */
export async function executeGetSelectedMediaMetadataTask(): Promise<{ 
  success: boolean; 
  data?: any;
  error?: string;
}> {
  try {
    // Send WebSocket event to frontend and wait for response
    const responseData = await sendAndWaitForResponse(
      {
        event: 'getSelectedMediaMetadata',
      },
      'selectedMediaMetadata', // Wait for this event in response
      10000 // 10 second timeout
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

