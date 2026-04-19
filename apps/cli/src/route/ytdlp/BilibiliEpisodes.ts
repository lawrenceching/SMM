import type { Hono } from 'hono';
import { runYtdlpPlaylistDump } from '../../utils/Ytdlp';
import { logger } from '../../../lib/logger';
import { validateDownloadUrl } from '@core/download-video-validators';

export interface YtdlpBilibiliEpisodesRequestBody {
  url?: string;
}

export interface YtdlpBilibiliEpisodesResponseData {
  stdout?: string;
  error?: string;
}

function isBilibiliHost(hostname: string): boolean {
  if (hostname === 'b23.tv') {
    return true;
  }
  return hostname === 'bilibili.com' || hostname.endsWith('.bilibili.com');
}

/**
 * Handle POST /api/ytdlp/bilibili/episodes — yt-dlp `-j` NDJSON for a Bilibili playlist/series URL.
 */
export async function processYtdlpBilibiliEpisodes(
  body: YtdlpBilibiliEpisodesRequestBody
): Promise<YtdlpBilibiliEpisodesResponseData> {
  const validation = validateDownloadUrl(body.url ?? '');
  if (!validation.valid) {
    return { error: validation.error };
  }

  const url = body.url!.trim();
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { error: 'URL_INVALID' };
  }

  if (!isBilibiliHost(parsed.hostname)) {
    return {
      error: 'URL must be a Bilibili or b23.tv link',
    };
  }

  try {
    return await runYtdlpPlaylistDump(url);
  } catch (error) {
    logger.error({ error }, 'Error dumping Bilibili playlist JSON with yt-dlp');
    return {
      error: `Failed to fetch episode metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export function handleYtdlpBilibiliEpisodes(app: Hono) {
  app.post('/api/ytdlp/bilibili/episodes', async (c) => {
    try {
      const rawBody = (await c.req.json()) as YtdlpBilibiliEpisodesRequestBody;
      const result = await processYtdlpBilibiliEpisodes(rawBody);

      if (result.error) {
        return c.json(result, 400);
      }
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'YtdlpBilibiliEpisodes route error');
      return c.json(
        {
          error: 'Failed to process yt-dlp bilibili episodes request',
        },
        500
      );
    }
  });
}
