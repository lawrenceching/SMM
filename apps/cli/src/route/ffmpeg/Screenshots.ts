import type { Hono } from 'hono';
import { generateVideoScreenshots, type GenerateScreenshotsResult } from '../../utils/Ffmpeg';
import { logger } from '../../../lib/logger';
import { Path } from '@core/path';

export interface ScreenshotsResponseData {
  screenshots?: string[];
  error?: string;
}

export async function processFfmpegScreenshots(
  videoPath: string,
  count?: string
): Promise<ScreenshotsResponseData> {
  if (!videoPath) {
    return { error: 'video path is required' };
  }

  const videoPathObj = new Path(videoPath);
  const absolutePath = videoPathObj.platformAbsPath();

  try {
    const result = await generateVideoScreenshots(absolutePath);
    return result;
  } catch (error) {
    logger.error({ error, videoPath: absolutePath }, 'Error generating video screenshots with ffmpeg');
    return { error: `Failed to generate screenshots: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

export function handleFfmpegScreenshots(app: Hono) {
  app.get('/api/ffmpeg/screenshots', async (c) => {
    try {
      const videoPath = c.req.query('videoPath');
      const count = c.req.query('count');

      if (!videoPath) {
        return c.json({ error: 'video path is required' }, 400);
      }

      logger.info({ videoPath, count }, 'Generating video screenshots');

      const result = await processFfmpegScreenshots(videoPath, count);

      if (result.error) {
        return c.json(result, 400);
      }

      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'FfmpegScreenshots route error');
      return c.json({
        error: 'Failed to process screenshots request',
      }, 500);
    }
  });
}
