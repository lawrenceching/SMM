import { z } from 'zod';
import { broadcastMessage, type WebSocketMessage } from '../utils/websocketManager';

interface DebugApiResponseBody {
  success: boolean;
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

// Union schema for all debug functions
const debugRequestSchema = z.discriminatedUnion('name', [
  broadcastMessageSchema,
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

      default: {
        return {
          success: false,
          error: `Unknown debug function: ${validatedBody.name}`,
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

