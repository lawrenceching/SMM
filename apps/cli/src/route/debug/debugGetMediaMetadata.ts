import { z } from 'zod/v3';
import { logger } from '../../../lib/logger';
import { agentTools } from '../../tools';
import type { Hono } from 'hono';

type MediaFolderType = 'tvshow-folder' | 'movie-folder' | 'music-folder';

interface GetMediaMetadataData {
  mediaFolderPath: string;
  type: MediaFolderType;
  tvShow?: unknown;
  tmdbMovie?: unknown;
  tvdbMovie?: unknown;
}

interface GetMediaMetadataStructuredContent {
  data?: GetMediaMetadataData;
  error?: string;
}

interface DebugGetMediaMetadataResponseBody {
  success: boolean;
  data?: GetMediaMetadataData;
  error?: string;
}

const getMediaMetadataSchema = z.object({
  mediaFolderPath: z.string().min(1, 'Media folder path is required'),
  clientId: z.string().optional(),
});

export async function processGetMediaMetadata(body: unknown): Promise<DebugGetMediaMetadataResponseBody> {
  try {
    console.log('[DebugAPI] Received getMediaMetadata request:', body);

    const validationResult = getMediaMetadataSchema.safeParse(body ?? {});
    if (!validationResult.success) {
      return {
        success: false,
        error: `Validation failed: ${validationResult.error.issues.map(i => i.message).join(', ')}`,
      };
    }

    const { mediaFolderPath, clientId = '' } = validationResult.data;
    const tool = agentTools.getMediaMetadata(clientId, undefined);
    const result = await tool.execute({ mediaFolderPath });

    if (result.isError) {
      return {
        success: false,
        error: result.content?.[0]?.text ?? 'Unknown error',
      };
    }

    const structuredContent = result.structuredContent as GetMediaMetadataStructuredContent | undefined;
    return {
      success: true,
      data: structuredContent?.data,
      error: structuredContent?.error,
    };
  } catch (error) {
    console.error('[DebugAPI] Error executing getMediaMetadata:', error);
    return {
      success: false,
      error: `Failed to execute getMediaMetadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export function handleDebugGetMediaMetadataRoute(app: Hono) {
  app.post('/debug/getMediaMetadata', async (c) => {
    try {
      const rawBody = await c.req.json();
      const result = await processGetMediaMetadata(rawBody);
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'Debug API getMediaMetadata route error:');
      return c.json({
        success: false,
        error: `Failed to process getMediaMetadata request: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }, 500);
    }
  });
}
