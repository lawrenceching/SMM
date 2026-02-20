import type { Hono } from 'hono';
import { downloadYtdlpVideo, type YtdlpDownloadRequestData } from '../../utils/Ytdlp';
import { logger } from '../../../lib/logger';
import { validateDownloadUrl } from '@core/download-video-validators';

export interface YtdlpDownloadResponseData {
  success?: boolean;
  error?: string;
  path?: string;
}

/**
 * Handle POST /api/ytdlp/download
 * Downloads a video using yt-dlp
 */
export async function processYtdlpDownload(
  body: YtdlpDownloadRequestData
): Promise<YtdlpDownloadResponseData> {
  const validation = validateDownloadUrl(body.url ?? '');
  if (!validation.valid) {
    return { error: validation.error };
  }

  try {
    return await downloadYtdlpVideo(body);
  } catch (error) {
    logger.error({ error }, 'Error downloading video with yt-dlp');
    return { error: `Failed to download video: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

export function handleYtdlpDownload(app: Hono) {
  app.post('/api/ytdlp/download', async (c) => {
    try {
      const rawBody = await c.req.json();
      const result = await processYtdlpDownload(rawBody);

      // Return 400 for validation errors
      if (result.error) {
        return c.json(result, 400);
      }
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'YtdlpDownload route error');
      return c.json({
        error: 'Failed to process yt-dlp download request',
      }, 500);
    }
  });
}
