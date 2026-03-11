import type { Hono } from 'hono';
import { z } from 'zod/v3';
import { getMediaTags, type MediaTagsResult } from '../../utils/Ffmpeg';
import { logger } from '../../../lib/logger';
import { Path } from '@core/path';

const tagsRequestSchema = z.object({
  path: z.string().min(1, 'path is required'),
});

export type TagsRequestBody = z.infer<typeof tagsRequestSchema>;

export interface FfmpegTagsResponse {
  tags?: Record<string, string>;
  error?: string;
}

export async function processFfmpegTags(
  body: TagsRequestBody
): Promise<FfmpegTagsResponse> {
  const pathObj = new Path(body.path);
  const absolutePath = pathObj.platformAbsPath();

  try {
    const result = await getMediaTags(absolutePath);
    return result;
  } catch (error) {
    logger.error({ error, path: absolutePath }, 'Error reading media tags with ffprobe');
    return {
      error: `Failed to read media tags: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    };
  }
}

export function handleFfmpegTags(app: Hono) {
  app.post('/api/ffprobe/readTags', async (c) => {
    try {
      const rawBody = await c.req.json();
      const parseResult = tagsRequestSchema.safeParse(rawBody);

      if (!parseResult.success) {
        const firstIssue = parseResult.error.issues[0];
        const message = firstIssue?.message ?? 'Invalid request body';
        return c.json({ error: message }, 400);
      }

      const body = parseResult.data;
      logger.info({ path: body.path }, 'Reading media tags with ffprobe');

      const result = await processFfmpegTags(body);

      if (result.error) {
        return c.json(result, 400);
      }

      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'FfmpegTags route error');
      return c.json(
        {
          error: 'Failed to process tags request',
        },
        500
      );
    }
  });

  app.post('/api/ffprobe/tags', async (c) => {
    logger.warn('Deprecated endpoint /api/ffprobe/tags is being called. Use /api/ffprobe/readTags instead.');
    
    try {
      const rawBody = await c.req.json();
      const parseResult = tagsRequestSchema.safeParse(rawBody);

      if (!parseResult.success) {
        const firstIssue = parseResult.error.issues[0];
        const message = firstIssue?.message ?? 'Invalid request body';
        return c.json({ error: message, deprecationWarning: 'This endpoint is deprecated. Use /api/ffprobe/readTags instead.' }, 400);
      }

      const body = parseResult.data;
      logger.info({ path: body.path }, 'Reading media tags with ffprobe (deprecated endpoint)');

      const result = await processFfmpegTags(body);

      if (result.error) {
        return c.json({ ...result, deprecationWarning: 'This endpoint is deprecated. Use /api/ffprobe/readTags instead.' }, 400);
      }

      return c.json({ ...result, deprecationWarning: 'This endpoint is deprecated. Use /api/ffprobe/readTags instead.' }, 200);
    } catch (error) {
      logger.error({ error }, 'FfmpegTags route error (deprecated endpoint)');
      return c.json(
        {
          error: 'Failed to process tags request',
          deprecationWarning: 'This endpoint is deprecated. Use /api/ffprobe/readTags instead.'
        },
        500
      );
    }
  });
}
