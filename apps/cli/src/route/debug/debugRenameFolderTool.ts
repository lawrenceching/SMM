import { z } from 'zod/v3';
import { logger } from '../../../lib/logger';
import { handleRenameFolder } from '../../tools/renameFolder';
import type { Hono } from 'hono';

interface RenameFolderToolData {
  renamed: boolean;
  from: string;
  to: string;
  error?: string;
}

interface DebugRenameFolderToolResponseBody {
  success: boolean;
  data?: RenameFolderToolData;
  error?: string;
}

const renameFolderToolSchema = z.object({
  from: z.string().min(1, 'Source folder path is required'),
  to: z.string().min(1, 'Destination folder path is required'),
});

export async function processRenameFolderTool(body: unknown): Promise<DebugRenameFolderToolResponseBody> {
  try {
    console.log('[DebugAPI] Received renameFolderTool request:', body);

    const validationResult = renameFolderToolSchema.safeParse(body ?? {});
    if (!validationResult.success) {
      return {
        success: false,
        error: `Validation failed: ${validationResult.error.issues.map(i => i.message).join(', ')}`,
      };
    }

    const result = await handleRenameFolder(validationResult.data, undefined);
    if (result.isError) {
      return {
        success: false,
        error: result.content?.[0]?.text ?? 'Unknown error',
      };
    }

    const data = result.structuredContent as RenameFolderToolData | undefined;
    return {
      success: !!data?.renamed && !data.error,
      data,
      error: data?.error,
    };
  } catch (error) {
    console.error('[DebugAPI] Error executing renameFolderTool:', error);
    return {
      success: false,
      error: `Failed to execute renameFolderTool: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export function handleDebugRenameFolderToolRoute(app: Hono) {
  app.post('/debug/renameFolderTool', async (c) => {
    try {
      const rawBody = await c.req.json();
      const result = await processRenameFolderTool(rawBody);
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'Debug API renameFolderTool route error:');
      return c.json({
        success: false,
        error: `Failed to process renameFolderTool request: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }, 500);
    }
  });
}
