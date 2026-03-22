import { z } from 'zod/v3';
import { logger } from '../../../lib/logger';
import {
  createBeginRecognizeTaskTool,
  createAddRecognizedMediaFileTool,
  createEndRecognizeTaskTool,
} from '../../tools/recognizeMediaFilesTask';
import type { Hono } from 'hono';

interface ToolResultBase {
  error?: string;
}

interface BeginRecognizeTaskToolResult extends ToolResultBase {
  taskId?: string;
}

interface AddRecognizedMediaFileToolResult extends ToolResultBase {}

interface EndRecognizeTaskToolResult extends ToolResultBase {}

interface DebugRecognizeTaskResponseBody<T extends ToolResultBase = ToolResultBase> {
  success: boolean;
  data?: T;
  error?: string;
}

const startRecognizeTaskSchema = z.object({
  mediaFolderPath: z.string().min(1, 'Media folder path is required'),
  clientId: z.string().optional(),
});

const addFileToRecognizeTaskSchema = z.object({
  taskId: z.string().min(1, 'Task ID is required'),
  season: z.number().int().min(0, 'Season number must be a non-negative integer'),
  episode: z.number().int().min(0, 'Episode number must be a non-negative integer'),
  path: z.string().min(1, 'File path is required'),
  clientId: z.string().optional(),
});

const endRecognizeTaskSchema = z.object({
  taskId: z.string().min(1, 'Task ID is required'),
  clientId: z.string().optional(),
});

export async function processStartRecognizeTask(body: any): Promise<DebugRecognizeTaskResponseBody<BeginRecognizeTaskToolResult>> {
  try {
    console.log(`[DebugAPI] Received startRecognizeTask request:`, body);

    const validationResult = startRecognizeTaskSchema.safeParse(body);

    if (!validationResult.success) {
      return {
        success: false,
        error: `Validation failed: ${validationResult.error.issues.map(i => i.message).join(', ')}`,
      };
    }

    const validatedBody = validationResult.data;
    const clientId = validatedBody.clientId || '';

    const tool = createBeginRecognizeTaskTool(clientId);

    const result: BeginRecognizeTaskToolResult = await tool.execute({
      mediaFolderPath: validatedBody.mediaFolderPath,
    });

    if (result.error) {
      console.log(`[DebugAPI] startRecognizeTask completed with error:`, result.error);
    } else {
      console.log(`[DebugAPI] startRecognizeTask completed successfully`);
    }

    return {
      success: !result.error,
      data: result,
      error: result.error,
    };
  } catch (error) {
    console.error(`[DebugAPI] Error executing startRecognizeTask:`, error);
    return {
      success: false,
      error: `Failed to execute startRecognizeTask: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export async function processAddFileToRecognizeTask(body: any): Promise<DebugRecognizeTaskResponseBody<AddRecognizedMediaFileToolResult>> {
  try {
    console.log(`[DebugAPI] Received addFileToRecognizeTask request:`, body);

    const validationResult = addFileToRecognizeTaskSchema.safeParse(body);

    if (!validationResult.success) {
      return {
        success: false,
        error: `Validation failed: ${validationResult.error.issues.map(i => i.message).join(', ')}`,
      };
    }

    const validatedBody = validationResult.data;
    const clientId = validatedBody.clientId || '';

    const tool = createAddRecognizedMediaFileTool(clientId);

    const result: AddRecognizedMediaFileToolResult = await tool.execute({
      taskId: validatedBody.taskId,
      season: validatedBody.season,
      episode: validatedBody.episode,
      path: validatedBody.path,
    });

    if (result.error) {
      console.log(`[DebugAPI] addFileToRecognizeTask completed with error:`, result.error);
    } else {
      console.log(`[DebugAPI] addFileToRecognizeTask completed successfully`);
    }

    return {
      success: !result.error,
      data: result,
      error: result.error,
    };
  } catch (error) {
    console.error(`[DebugAPI] Error executing addFileToRecognizeTask:`, error);
    return {
      success: false,
      error: `Failed to execute addFileToRecognizeTask: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export async function processEndRecognizeTask(body: any): Promise<DebugRecognizeTaskResponseBody<EndRecognizeTaskToolResult>> {
  try {
    console.log(`[DebugAPI] Received endRecognizeTask request:`, body);

    const validationResult = endRecognizeTaskSchema.safeParse(body);

    if (!validationResult.success) {
      return {
        success: false,
        error: `Validation failed: ${validationResult.error.issues.map(i => i.message).join(', ')}`,
      };
    }

    const validatedBody = validationResult.data;
    const clientId = validatedBody.clientId || '';

    const tool = createEndRecognizeTaskTool(clientId);

    const result: EndRecognizeTaskToolResult = await tool.execute({
      taskId: validatedBody.taskId,
    });

    if (result.error) {
      console.log(`[DebugAPI] endRecognizeTask completed with error:`, result.error);
    } else {
      console.log(`[DebugAPI] endRecognizeTask completed successfully`);
    }

    return {
      success: !result.error,
      data: result,
      error: result.error,
    };
  } catch (error) {
    console.error(`[DebugAPI] Error executing endRecognizeTask:`, error);
    return {
      success: false,
      error: `Failed to execute endRecognizeTask: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export function handleDebugRecognizeTaskRoutes(app: Hono) {
  app.post('/debug/startRecognizeTask', async (c) => {
    try {
      const rawBody = await c.req.json();
      const result = await processStartRecognizeTask(rawBody);

      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'Debug API startRecognizeTask route error:');
      return c.json({
        success: false,
        error: `Failed to process startRecognizeTask request: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }, 500);
    }
  });

  app.post('/debug/addFileToRecognizeTask', async (c) => {
    try {
      const rawBody = await c.req.json();
      const result = await processAddFileToRecognizeTask(rawBody);

      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'Debug API addFileToRecognizeTask route error:');
      return c.json({
        success: false,
        error: `Failed to process addFileToRecognizeTask request: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }, 500);
    }
  });

  app.post('/debug/endRecognizeTask', async (c) => {
    try {
      const rawBody = await c.req.json();
      const result = await processEndRecognizeTask(rawBody);

      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'Debug API endRecognizeTask route error:');
      return c.json({
        success: false,
        error: `Failed to process endRecognizeTask request: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }, 500);
    }
  });
}
