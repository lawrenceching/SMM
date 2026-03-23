import { z } from 'zod/v3';
import { logger } from '../../../lib/logger';
import { agentTools } from '../../tools';
import type { Hono } from 'hono';

interface GetMediaFoldersData {
  folders: string[];
}

interface DebugGetMediaFoldersResponseBody {
  success: boolean;
  data?: GetMediaFoldersData;
  error?: string;
}

const getMediaFoldersSchema = z.object({
  clientId: z.string().optional(),
});

export async function processGetMediaFolders(body: unknown): Promise<DebugGetMediaFoldersResponseBody> {
  try {
    const validationResult = getMediaFoldersSchema.safeParse(body ?? {});
    if (!validationResult.success) {
      return {
        success: false,
        error: `Validation failed: ${validationResult.error.issues.map(i => i.message).join(', ')}`,
      };
    }

    const { clientId = '' } = validationResult.data;
    const tool = agentTools.getMediaFolders(clientId);
    const result = await tool.execute({});

    if (result.isError) {
      return {
        success: false,
        error: result.content?.[0]?.text ?? 'Unknown error',
      };
    }

    const data = result.structuredContent as GetMediaFoldersData | undefined;
    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to execute getMediaFolders tool: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export function handleDebugGetMediaFoldersRoute(app: Hono) {
  app.post('/debug/getMediaFolders', async (c) => {
    try {
      let rawBody: unknown = {};
      try {
        rawBody = await c.req.json();
      } catch {
        rawBody = {};
      }
      const result = await processGetMediaFolders(rawBody);
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'Debug API getMediaFolders route error:');
      return c.json({
        success: false,
        error: `Failed to process getMediaFolders request: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }, 500);
    }
  });
}
