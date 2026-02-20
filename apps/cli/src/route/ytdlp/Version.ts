import type { Hono } from 'hono';
import { getYtdlpVersion } from '../../utils/Ytdlp';
import { logger } from '../../../lib/logger';

export interface YtdlpVersionResponseData {
  version?: string;
  error?: string;
}

/**
 * Handle GET /api/ytdlp/version
 * Returns the yt-dlp version
 */
export async function processYtdlpVersion(): Promise<YtdlpVersionResponseData> {
  try {
    return await getYtdlpVersion();
  } catch (error) {
    logger.error({ error }, 'Error getting yt-dlp version');
    return { error: `Failed to get yt-dlp version: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

export function handleYtdlpVersion(app: Hono) {
  app.get('/api/ytdlp/version', async (c) => {
    try {
      const result = await processYtdlpVersion();
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'YtdlpVersion route error');
      return c.json({
        error: 'Failed to process yt-dlp version request',
      }, 500);
    }
  });
}
