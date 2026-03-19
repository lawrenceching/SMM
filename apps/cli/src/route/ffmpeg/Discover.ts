import type { Hono } from 'hono';
import { discoverFfmpeg } from '../../utils/Ffmpeg';
import { logger } from '../../../lib/logger';

export interface FfmpegDiscoverResponseData {
  path?: string;
  error?: string;
}

/**
 * Handle GET /api/ffmpeg/discover
 * Returns the discovered ffmpeg binary executable path
 */
export async function processFfmpegDiscover(): Promise<FfmpegDiscoverResponseData> {
  try {
    logger.debug('processFfmpegDiscover: discovering ffmpeg');
    const path = await discoverFfmpeg();
    if (path) {
      logger.info({ path }, 'processFfmpegDiscover: ffmpeg discovered');
      return { path };
    }
    logger.warn('processFfmpegDiscover: ffmpeg not found');
    return { error: 'ffmpeg not found' };
  } catch (error) {
    logger.error({ error }, 'Error discovering ffmpeg');
    return { error: `Failed to discover ffmpeg: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

export function handleFfmpegDiscover(app: Hono) {
  app.get('/api/ffmpeg/discover', async (c) => {
    try {
      const result = await processFfmpegDiscover();
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'FfmpegDiscover route error');
      return c.json({
        error: 'Failed to process ffmpeg discover request',
      }, 500);
    }
  });
}
