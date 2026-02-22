import type { Hono } from 'hono';
import { extractVideoData, type YtdlpVideoDataResult } from '../../utils/Ytdlp';
import { logger } from '../../../lib/logger';
import { validateDownloadUrl } from '@core/download-video-validators';

export interface YtdlpExtractDataResponseData {
  title?: string;
  artist?: string;
  error?: string;
}

/**
 * Handle GET /api/ytdlp/extract-data
 * Extracts video metadata (title and artist) using yt-dlp
 */
export async function processYtdlpExtractData(
  url: string
): Promise<YtdlpExtractDataResponseData> {
  const validation = validateDownloadUrl(url ?? '');
  if (!validation.valid) {
    return { error: validation.error };
  }

  try {
    return await extractVideoData(url);
  } catch (error) {
    logger.error({ error }, 'Error extracting video data with yt-dlp');
    return { error: `Failed to extract video data: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

export function handleYtdlpExtractData(app: Hono) {
  app.get('/api/ytdlp/extract-data', async (c) => {
    try {
      const url = c.req.query('url');
      const result = await processYtdlpExtractData(url ?? '');

      // Return 400 for validation errors
      if (result.error) {
        return c.json(result, 400);
      }
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'YtdlpExtractData route error');
      return c.json({
        error: 'Failed to process yt-dlp extract-data request',
      }, 500);
    }
  });
}
