import type { Hono } from 'hono';
import { getFfmpegVersion } from '../../utils/Ffmpeg';
import { logger } from '../../../lib/logger';

export interface FfmpegVersionResponseData {
  version?: string;
  error?: string;
}

/**
 * Handle GET /api/ffmpeg/version
 * Returns the ffmpeg version
 */
export async function processFfmpegVersion(): Promise<FfmpegVersionResponseData> {
  try {
    const result = await getFfmpegVersion();
    return result;
  } catch (error) {
    logger.error({ error }, 'Error getting ffmpeg version');
    return { error: `Failed to get ffmpeg version: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

export function handleFfmpegVersion(app: Hono) {
  app.get('/api/ffmpeg/version', async (c) => {
    try {
      const result = await processFfmpegVersion();
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'FfmpegVersion route error');
      return c.json({
        error: 'Failed to process ffmpeg version request',
      }, 500);
    }
  });
}
