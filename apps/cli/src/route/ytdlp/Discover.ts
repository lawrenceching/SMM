import type { Hono } from 'hono';
import { discoverYtdlp } from '../../utils/Ytdlp';
import { logger } from '../../../lib/logger';

export interface YtdlpDiscoverResponseData {
  path?: string;
  error?: string;
}

/**
 * Handle GET /api/ytdlp/discover
 * Returns the discovered yt-dlp binary executable path
 */
export async function processYtdlpDiscover(): Promise<YtdlpDiscoverResponseData> {
  try {
    const path = await discoverYtdlp();
    if (path) {
      return { path };
    }
    return { error: 'yt-dlp not found' };
  } catch (error) {
    logger.error({ error }, 'Error discovering yt-dlp');
    return { error: `Failed to discover yt-dlp: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

export function handleYtdlpDiscover(app: Hono) {
  app.get('/api/ytdlp/discover', async (c) => {
    try {
      const result = await processYtdlpDiscover();
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'YtdlpDiscover route error');
      return c.json({
        error: 'Failed to process yt-dlp discover request',
      }, 500);
    }
  });
}
