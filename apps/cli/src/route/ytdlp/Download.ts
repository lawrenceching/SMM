import type { Hono } from 'hono';
import { downloadYtdlpVideo, type YtdlpDownloadRequestData } from '../../utils/Ytdlp';
import { logger } from '../../../lib/logger';
import { validateDownloadUrl } from '@core/download-video-validators';

export interface YtdlpDownloadResponseData {
  success?: boolean;
  error?: string;
  /**
   * The absolute path in platform-specific format
   */
  path?: string;
}

/**
 * Handle POST /api/ytdlp/download
 * Downloads a video using yt-dlp
 */
export async function processYtdlpDownload(
  body: YtdlpDownloadRequestData,
  signal?: AbortSignal
): Promise<YtdlpDownloadResponseData> {
  const validation = validateDownloadUrl(body.url ?? '');
  if (!validation.valid) {
    return { error: validation.error };
  }

  try {
    return await downloadYtdlpVideo(body, signal);
  } catch (error) {
    logger.error({ error }, 'Error downloading video with yt-dlp');
    return { error: `Failed to download video: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

export function handleYtdlpDownload(app: Hono) {
  app.post('/api/ytdlp/download', async (c) => {
    const requestId = crypto.randomUUID().slice(0, 8);
    logger.info({ requestId }, '[Download] POST /api/ytdlp/download received');

    try {
      const rawBody = await c.req.json();
      logger.info({ requestId, url: rawBody.url, folder: rawBody.folder }, '[Download] starting download');

      const signal = c.req.raw.signal;
      const onAbort = () => {
        logger.warn({ requestId, url: rawBody.url }, '[Download] client disconnected (abort signal)');
      };
      signal.addEventListener('abort', onAbort, { once: true });

      const result = await processYtdlpDownload(rawBody, signal);

      signal.removeEventListener('abort', onAbort);

      if (signal.aborted) {
        logger.warn({ requestId, url: rawBody.url }, '[Download] request was aborted during processing');
      }

      if (result.error) {
        logger.warn({ requestId, error: result.error }, '[Download] download failed');
        return c.json(result, 400);
      }

      logger.info({ requestId, path: result.path }, '[Download] download completed');
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error, requestId }, '[Download] route error');
      return c.json({
        error: 'Failed to process yt-dlp download request',
      }, 500);
    }
  });
}
