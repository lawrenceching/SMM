import { z } from 'zod/v3';
import { logger } from '../../../lib/logger';
import {
  createBeginRenameFilesTaskV2Tool,
  createAddRenameFileToTaskV2Tool,
  createEndRenameFilesTaskV2Tool,
} from '../../tools/renameFilesTaskV2';
import type { Hono } from 'hono';

interface ToolResultBase {
  error?: string;
}

interface BeginRenameFilesTaskToolResult extends ToolResultBase {
  taskId?: string;
}

interface AddRenameFileToTaskToolResult extends ToolResultBase {}

interface EndRenameFilesTaskToolResult extends ToolResultBase {}

interface DebugRenameFilesTaskResponseBody<T extends ToolResultBase = ToolResultBase> {
  success: boolean;
  data?: T;
  error?: string;
}

const startRenameFilesTaskSchema = z.object({
  mediaFolderPath: z.string().min(1, 'Media folder path is required'),
  clientId: z.string().optional(),
});

const addFileToRenameTaskSchema = z.object({
  taskId: z.string().min(1, 'Task ID is required'),
  from: z.string().min(1, 'Current file path is required'),
  to: z.string().min(1, 'New file path is required'),
  clientId: z.string().optional(),
});

const endRenameFilesTaskSchema = z.object({
  taskId: z.string().min(1, 'Task ID is required'),
  clientId: z.string().optional(),
});

export async function processStartRenameFilesTask(body: any): Promise<DebugRenameFilesTaskResponseBody<BeginRenameFilesTaskToolResult>> {
  try {
    console.log(`[DebugAPI] Received startRenameFilesTask request:`, body);

    const validationResult = startRenameFilesTaskSchema.safeParse(body);

    if (!validationResult.success) {
      return {
        success: false,
        error: `Validation failed: ${validationResult.error.issues.map(i => i.message).join(', ')}`,
      };
    }

    const validatedBody = validationResult.data;
    const clientId = validatedBody.clientId || '';

    const tool = createBeginRenameFilesTaskV2Tool(clientId);

    const result: BeginRenameFilesTaskToolResult = await tool.execute({
      mediaFolderPath: validatedBody.mediaFolderPath,
    });

    if (result.error) {
      console.log(`[DebugAPI] startRenameFilesTask completed with error:`, result.error);
    } else {
      console.log(`[DebugAPI] startRenameFilesTask completed successfully`);
    }

    return {
      success: !result.error,
      data: result,
      error: result.error,
    };
  } catch (error) {
    console.error(`[DebugAPI] Error executing startRenameFilesTask:`, error);
    return {
      success: false,
      error: `Failed to execute startRenameFilesTask: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export async function processAddFileToRenameTask(body: any): Promise<DebugRenameFilesTaskResponseBody<AddRenameFileToTaskToolResult>> {
  try {
    console.log(`[DebugAPI] Received addFileToRenameTask request:`, body);

    const validationResult = addFileToRenameTaskSchema.safeParse(body);

    if (!validationResult.success) {
      return {
        success: false,
        error: `Validation failed: ${validationResult.error.issues.map(i => i.message).join(', ')}`,
      };
    }

    const validatedBody = validationResult.data;
    const clientId = validatedBody.clientId || '';

    const tool = createAddRenameFileToTaskV2Tool(clientId);

    const result: AddRenameFileToTaskToolResult = await tool.execute({
      taskId: validatedBody.taskId,
      from: validatedBody.from,
      to: validatedBody.to,
    });

    if (result.error) {
      console.log(`[DebugAPI] addFileToRenameTask completed with error:`, result.error);
    } else {
      console.log(`[DebugAPI] addFileToRenameTask completed successfully`);
    }

    return {
      success: !result.error,
      data: result,
      error: result.error,
    };
  } catch (error) {
    console.error(`[DebugAPI] Error executing addFileToRenameTask:`, error);
    return {
      success: false,
      error: `Failed to execute addFileToRenameTask: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export async function processEndRenameFilesTask(body: any): Promise<DebugRenameFilesTaskResponseBody<EndRenameFilesTaskToolResult>> {
  try {
    console.log(`[DebugAPI] Received endRenameFilesTask request:`, body);

    const validationResult = endRenameFilesTaskSchema.safeParse(body);

    if (!validationResult.success) {
      return {
        success: false,
        error: `Validation failed: ${validationResult.error.issues.map(i => i.message).join(', ')}`,
      };
    }

    const validatedBody = validationResult.data;
    const clientId = validatedBody.clientId || '';

    const tool = createEndRenameFilesTaskV2Tool(clientId);

    const result: EndRenameFilesTaskToolResult = await tool.execute({
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

export function handleDebugRenameFilesTaskRoutes(app: Hono) {
  app.post('/debug/startRenameFilesTask', async (c) => {
    try {
      const rawBody = await c.req.json();
      const result = await processStartRenameFilesTask(rawBody);

      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'Debug API startRenameFilesTask route error:');
      return c.json({
        success: false,
        error: `Failed to process startRenameFilesTask request: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }, 500);
    }
  });

  app.post('/debug/addFileToRenameTask', async (c) => {
    try {
      const rawBody = await c.req.json();
      const result = await processAddFileToRenameTask(rawBody);

      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'Debug API addFileToRenameTask route error:');
      return c.json({
        success: false,
        error: `Failed to process addFileToRenameTask request: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }, 500);
    }
  });

  app.post('/debug/endRenameFilesTask', async (c) => {
    try {
      const rawBody = await c.req.json();
      const result = await processEndRenameFilesTask(rawBody);

      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'Debug API endRenameFilesTask route error:');
      return c.json({
        success: false,
        error: `Failed to process endRenameFilesTask request: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }, 500);
    }
  });
}
