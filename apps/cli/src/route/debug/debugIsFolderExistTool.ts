import { z } from 'zod/v3';
import { logger } from '../../../lib/logger';
import { agentTools } from '../../tools';
import type { Hono } from 'hono';

interface IsFolderExistData {
  exists: boolean;
  path: string;
  reason?: string;
}

interface DebugIsFolderExistToolResponseBody {
  success: boolean;
  data?: IsFolderExistData;
  error?: string;
}

const isFolderExistToolSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  clientId: z.string().optional(),
});

export async function processIsFolderExistTool(body: unknown): Promise<DebugIsFolderExistToolResponseBody> {
  try {
    const validationResult = isFolderExistToolSchema.safeParse(body ?? {});
    if (!validationResult.success) {
      return {
        success: false,
        error: `Validation failed: ${validationResult.error.issues.map(i => i.message).join(', ')}`,
      };
    }

    const { path, clientId = '' } = validationResult.data;
    const tool = agentTools.isFolderExist(clientId);
    const result = await tool.execute({ path });

    if (result.isError) {
      return {
        success: false,
        error: result.content?.[0]?.text ?? 'Unknown error',
      };
    }

    const data = result.structuredContent as IsFolderExistData | undefined;
    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to execute isFolderExist tool: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export function handleDebugIsFolderExistToolRoute(app: Hono) {
  app.post('/debug/isFolderExistTool', async (c) => {
    try {
      const rawBody = await c.req.json();
      const result = await processIsFolderExistTool(rawBody);
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'Debug API isFolderExistTool route error:');
      return c.json({
        success: false,
        error: `Failed to process isFolderExistTool request: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }, 500);
    }
  });
}
