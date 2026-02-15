import { z } from 'zod/v3';
import { broadcast, acknowledge, type WebSocketMessage } from '../utils/socketIO';
import type { Hono } from 'hono';
import { logger } from '../../lib/logger';
import { getUserConfigPath } from '../utils/config';
import { mediaMetadataDir } from '../route/mediaMetadata/utils';
import { unlink, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { endRenameFilesTaskV2, readRenamePlanFile, getPlanFilePath } from '../tools/renameFilesToolV2';

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

// Schema for renameFilesInBatch function
const renameFilesInBatchSchema = debugRequestBaseSchema.extend({
  name: z.literal('renameFilesInBatch'),
  folderPath: z.string().min(1, 'Folder path is required'),
  files: z.array(z.object({
    from: z.string().min(1, 'Source path is required'),
    to: z.string().min(1, 'Destination path is required'),
  })).min(1, 'At least one file rename operation is required'),
  clientId: z.string().optional(),
});

// Schema for beginRenameFilesTask function
const beginRenameFilesTaskSchema = debugRequestBaseSchema.extend({
  name: z.literal('beginRenameFilesTask'),
  mediaFolderPath: z.string().min(1, 'Media folder path is required'),
  clientId: z.string().optional(),
});

// Schema for addRenameFileToTask function
const addRenameFileToTaskSchema = debugRequestBaseSchema.extend({
  name: z.literal('addRenameFileToTask'),
  taskId: z.string().min(1, 'Task ID is required'),
  from: z.string().min(1, 'Source path is required'),
  to: z.string().min(1, 'Destination path is required'),
  clientId: z.string().optional(),
});

// Schema for endRenameFilesTask function
const endRenameFilesTaskSchema = debugRequestBaseSchema.extend({
  name: z.literal('endRenameFilesTask'),
  taskId: z.string().min(1, 'Task ID is required'),
  clientId: z.string().optional(),
});

// Schema for renameFilesPlanReady function
const renameFilesPlanReadySchema = debugRequestBaseSchema.extend({
  name: z.literal('renameFilesPlanReady'),
  taskId: z.string().min(1, 'Task ID is required'),
});

// Schema for cleanUp function
const cleanUpSchema = debugRequestBaseSchema.extend({
  name: z.literal('cleanUp'),
});

// Union schema for all debug functions
const debugRequestSchema = z.discriminatedUnion('name', [
  broadcastMessageSchema,
  retrieveSchema,
  renameFilesInBatchSchema,
  beginRenameFilesTaskSchema,
  addRenameFileToTaskSchema,
  endRenameFilesTaskSchema,
  renameFilesPlanReadySchema,
  cleanUpSchema,
  // Add more schemas here as new debug functions are added
]);

export async function processDebugRequest(body: any): Promise<DebugApiResponseBody> {
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
          
          broadcast({
            event: validatedBody.event,
            data: validatedBody.data,
          });
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
          const message: WebSocketMessage = {
            event: validatedBody.event,
            data: validatedBody.data,
          };
          
          console.log(`[DebugAPI] Sending retrieve request: event=${validatedBody.event}`);
          
          // Send and wait for acknowledgement response with 30 second timeout
          // Socket.IO handles the response via acknowledgement callback
          const responseData = await acknowledge(
            {
              event: validatedBody.event,
              data: validatedBody.data,
              clientId: validatedBody.clientId,
            },
          );
          
          console.log(`[DebugAPI] Received acknowledgement for retrieve request:`, responseData);
          
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

      case 'renameFilesInBatch': {
        try {
          console.log(`[DebugAPI] Executing renameFilesInBatch:`, {
            folderPath: validatedBody.folderPath,
            fileCount: validatedBody.files.length,
            clientId: validatedBody.clientId || 'not provided'
          });
          
          const { createRenameFilesInBatchTool } = await import('../tools/renameFilesInBatch');
          const clientId = validatedBody.clientId || '';
          const tool = createRenameFilesInBatchTool(clientId);
          
          const result = await tool.execute({
            folderPath: validatedBody.folderPath,
            files: validatedBody.files,
          });
          
          if (result.error) {
            console.log(`[DebugAPI] renameFilesInBatch completed with error:`, result.error);
          } else {
            console.log(`[DebugAPI] renameFilesInBatch completed successfully`);
          }
          
          return {
            success: !result.error,
            data: result,
            error: result.error,
          };
        } catch (error) {
          console.error(`[DebugAPI] Error executing renameFilesInBatch:`, error);
          return {
            success: false,
            error: `Failed to execute renameFilesInBatch: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      }

      case 'beginRenameFilesTask': {
        try {
          console.log(`[DebugAPI] Executing beginRenameFilesTask:`, {
            mediaFolderPath: validatedBody.mediaFolderPath,
            clientId: validatedBody.clientId || 'not provided'
          });
          
          const { createBeginRenameFilesTaskTool } = await import('../tools/renameFilesTask');
          const clientId = validatedBody.clientId || '';
          const tool = await createBeginRenameFilesTaskTool(clientId);
          
          const result = await tool.execute({
            mediaFolderPath: validatedBody.mediaFolderPath,
          });
          
          if (result.error) {
            console.log(`[DebugAPI] beginRenameFilesTask completed with error:`, result.error);
          } else {
            console.log(`[DebugAPI] beginRenameFilesTask completed successfully, taskId:`, result.taskId);
          }
          
          return {
            success: !result.error,
            data: result,
            error: result.error,
          };
        } catch (error) {
          console.error(`[DebugAPI] Error executing beginRenameFilesTask:`, error);
          return {
            success: false,
            error: `Failed to execute beginRenameFilesTask: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      }

      case 'addRenameFileToTask': {
        try {
          console.log(`[DebugAPI] Executing addRenameFileToTask:`, {
            taskId: validatedBody.taskId,
            from: validatedBody.from,
            to: validatedBody.to,
            clientId: validatedBody.clientId || 'not provided'
          });
          
          const { createAddRenameFileToTaskTool } = await import('../tools/renameFilesTask');
          const clientId = validatedBody.clientId || '';
          const tool = await createAddRenameFileToTaskTool(clientId);
          
          const result = await tool.execute({
            taskId: validatedBody.taskId,
            from: validatedBody.from,
            to: validatedBody.to,
          });
          
          if (result.error) {
            console.log(`[DebugAPI] addRenameFileToTask completed with error:`, result.error);
          } else {
            console.log(`[DebugAPI] addRenameFileToTask completed successfully`);
          }
          
          return {
            success: !result.error,
            data: result,
            error: result.error,
          };
        } catch (error) {
          console.error(`[DebugAPI] Error executing addRenameFileToTask:`, error);
          return {
            success: false,
            error: `Failed to execute addRenameFileToTask: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      }

      case 'endRenameFilesTask': {
        try {
          console.log(`[DebugAPI] Executing endRenameFilesTask:`, {
            taskId: validatedBody.taskId,
            clientId: validatedBody.clientId || 'not provided'
          });
          
          const { createEndRenameFilesTaskTool } = await import('../tools/renameFilesTask');
          const clientId = validatedBody.clientId || '';
          const tool = await createEndRenameFilesTaskTool(clientId);
          
          const result = await tool.execute({
            taskId: validatedBody.taskId,
          });
          
          if (result.error) {
            console.log(`[DebugAPI] endRenameFilesTask completed with error:`, result.error);
          } else {
            console.log(`[DebugAPI] endRenameFilesTask completed successfully`);
          }
          
          return {
            success: !result.error,
            data: result,
            error: result.error,
          };
        } catch (error) {
          console.error(`[DebugAPI] Error executing endRenameFilesTask:`, error);
          return {
            success: false,
            error: `Failed to execute endRenameFilesTask: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      }

      case 'renameFilesPlanReady': {
        try {
          console.log(`[DebugAPI] Executing renameFilesPlanReady:`, {
            taskId: validatedBody.taskId
          });
          
          const plan = await readRenamePlanFile(validatedBody.taskId);
          
          if (plan) {
            plan.status = 'pending';
            const planFilePath = getPlanFilePath(validatedBody.taskId);
            await Bun.write(planFilePath, JSON.stringify(plan, null, 2));
            console.log(`[DebugAPI] Reset plan status to pending`);
          } else {
            console.log(`[DebugAPI] Plan not found, proceeding with endRenameFilesTaskV2`);
          }
          
          await endRenameFilesTaskV2(validatedBody.taskId);
          
          console.log(`[DebugAPI] renameFilesPlanReady completed successfully`);
          
          return {
            success: true,
          };
        } catch (error) {
          console.error(`[DebugAPI] Error executing renameFilesPlanReady:`, error);
          return {
            success: false,
            error: `Failed to execute renameFilesPlanReady: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      }

      case 'cleanUp': {
        try {
          console.log(`[DebugAPI] Executing cleanUp`);
          
          const results: { configDeleted?: boolean; metadataDeleted?: boolean } = {};
          const errors: string[] = [];
          
          // Delete user config file
          try {
            const configPath = getUserConfigPath();
            if (existsSync(configPath)) {
              await unlink(configPath);
              results.configDeleted = true;
              console.log(`[DebugAPI] Deleted user config file: ${configPath}`);
            } else {
              console.log(`[DebugAPI] User config file does not exist: ${configPath}`);
            }
          } catch (error) {
            const errorMsg = `Failed to delete user config: ${error instanceof Error ? error.message : 'Unknown error'}`;
            errors.push(errorMsg);
            console.error(`[DebugAPI] ${errorMsg}`, error);
          }
          
          // Delete media metadata cache directory
          try {
            if (existsSync(mediaMetadataDir)) {
              await rm(mediaMetadataDir, { recursive: true, force: true });
              results.metadataDeleted = true;
              console.log(`[DebugAPI] Deleted media metadata cache directory: ${mediaMetadataDir}`);
            } else {
              console.log(`[DebugAPI] Media metadata cache directory does not exist: ${mediaMetadataDir}`);
            }
          } catch (error) {
            const errorMsg = `Failed to delete media metadata cache: ${error instanceof Error ? error.message : 'Unknown error'}`;
            errors.push(errorMsg);
            console.error(`[DebugAPI] ${errorMsg}`, error);
          }
          
          if (errors.length > 0) {
            console.log(`[DebugAPI] cleanUp completed with errors:`, errors);
            return {
              success: false,
              data: results,
              error: errors.join('; '),
            };
          } else {
            console.log(`[DebugAPI] cleanUp completed successfully`);
            return {
              success: true,
              data: results,
            };
          }
        } catch (error) {
          console.error(`[DebugAPI] Error executing cleanUp:`, error);
          return {
            success: false,
            error: `Failed to execute cleanUp: ${error instanceof Error ? error.message : 'Unknown error'}`,
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

export function handleDebugRequest(app: Hono) {
  // POST /debug - Debug API for testing functions
  app.post('/debug', async (c) => {
    try {
      const rawBody = await c.req.json();
      const result = await processDebugRequest(rawBody);
      
      // Return 200 with success/error status
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'Debug API route error:');
      return c.json({
        success: false,
        error: `Failed to process debug request: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }, 500);
    }
  });
}
