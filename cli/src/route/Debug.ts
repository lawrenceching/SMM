import { z } from 'zod';
import { broadcastMessage, sendAndWaitForResponse, type WebSocketMessage } from '../utils/websocketManager';

interface DebugApiResponseBody {
  success: boolean;
  data?: any;
  error?: string;
}

// Base schema for all debug requests
const debugRequestBaseSchema = z.object({
  name: z.string().min(1, 'Function name is required'),
});

// Schema for broadcastMessage function
const broadcastMessageSchema = debugRequestBaseSchema.extend({
  name: z.literal('broadcastMessage'),
  event: z.string().min(1, 'Event name is required for broadcastMessage'),
  data: z.any().optional(),
});

// Schema for retrieve function
const retrieveSchema = debugRequestBaseSchema.extend({
  name: z.literal('retrieve'),
  event: z.string().min(1, 'Event name is required for retrieve'),
  clientId: z.string().optional(),
  data: z.any().optional(),
});

// Union schema for all debug functions
const debugRequestSchema = z.discriminatedUnion('name', [
  broadcastMessageSchema,
  retrieveSchema,
  // Add more schemas here as new debug functions are added
]);

export async function handleDebugRequest(body: any): Promise<DebugApiResponseBody> {
  try {
    console.log(`[DebugAPI] Received debug request:`, body);

    // Validate request body
    const validationResult = debugRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return {
        success: false,
        error: `Validation failed: ${validationResult.error.issues.map(i => i.message).join(', ')}`,
      };
    }

    const validatedBody = validationResult.data;

    // Route to appropriate debug function
    switch (validatedBody.name) {
      case 'broadcastMessage': {
        try {
          const message: WebSocketMessage = {
            event: validatedBody.event,
            data: validatedBody.data,
          };
          
          broadcastMessage(message);
          console.log(`[DebugAPI] Successfully broadcasted message: ${validatedBody.event}`);
          
          return {
            success: true,
          };
        } catch (error) {
          console.error(`[DebugAPI] Error broadcasting message:`, error);
          return {
            success: false,
            error: `Failed to broadcast message: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      }

      case 'retrieve': {
        try {
          // Determine response event name based on the sent event
          // Pattern: askForConfirmation -> askForConfirmationResponse
          const responseEvent = `${validatedBody.event}Response`;
          
          const message: WebSocketMessage = {
            event: validatedBody.event,
            data: validatedBody.data,
          };
          
          console.log(`[DebugAPI] Sending retrieve request: event=${validatedBody.event}, waiting for response event=${responseEvent}`);
          
          // Send and wait for response with 30 second timeout
          const responseData = await sendAndWaitForResponse(
            message,
            responseEvent,
            30000, // 30 second timeout for user interactions
            validatedBody.clientId
          );
          
          console.log(`[DebugAPI] Received response for retrieve request:`, responseData);
          
          return {
            success: true,
            data: responseData,
          };
        } catch (error) {
          console.error(`[DebugAPI] Error retrieving data:`, error);
          return {
            success: false,
            error: `Failed to retrieve data: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      }

      default: {
        // TypeScript narrowing: this should never happen with discriminated union
        const _exhaustive: never = validatedBody;
        return {
          success: false,
          error: `Unknown debug function: ${(validatedBody as any).name}`,
        };
      }
    }
  } catch (error) {
    console.error(`[DebugAPI] Unexpected error:`, error);
    return {
      success: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

