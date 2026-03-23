import { z } from 'zod/v3';
import { logger } from '../../../lib/logger';
import { agentTools } from '../../tools';
import type { Hono } from 'hono';

interface ListFilesToolData {
  files: string[];
  count: number;
}

interface DebugListFilesToolResponseBody {
  success: boolean;
  data?: ListFilesToolData;
  error?: string;
}

const listFilesToolSchema = z.object({
  folderPath: z.string().min(1, 'Folder path is required'),
  recursive: z.boolean().optional(),
  filter: z.string().optional(),
  videoFileOnly: z.boolean().optional(),
  clientId: z.string().optional(),
});

export async function processListFilesTool(body: unknown): Promise<DebugListFilesToolResponseBody> {
  try {
    const validationResult = listFilesToolSchema.safeParse(body ?? {});
    if (!validationResult.success) {
      return {
        success: false,
        error: `Validation failed: ${validationResult.error.issues.map(i => i.message).join(', ')}`,
      };
    }

    const { clientId = '', ...args } = validationResult.data;
    const tool = agentTools.listFiles(clientId);
    const result = await tool.execute(args);

    if (result.isError) {
      return {
        success: false,
        error: result.content?.[0]?.text ?? 'Unknown error',
      };
    }

    const data = result.structuredContent as ListFilesToolData | undefined;
    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to execute listFiles tool: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export function handleDebugListFilesToolRoute(app: Hono) {
  app.post('/debug/listFilesTool', async (c) => {
    try {
      const rawBody = await c.req.json();
      const result = await processListFilesTool(rawBody);
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'Debug API listFilesTool route error:');
      return c.json({
        success: false,
        error: `Failed to process listFilesTool request: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }, 500);
    }
  });
}
