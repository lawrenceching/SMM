import type { Hono } from 'hono';
import { z } from 'zod/v3';
import { writeMediaTags, type WriteMediaTagsResult } from '../../utils/Ffmpeg';
import { logger } from '../../../lib/logger';
import { Path } from '@core/path';

const writeTagsRequestSchema = z.object({
  path: z.string().min(1, 'path is required'),
  tags: z.record(z.string()).refine((tags) => Object.keys(tags).length > 0, {
    message: 'tags must not be empty'
  })
});

export type WriteTagsRequestBody = z.infer<typeof writeTagsRequestSchema>;

export interface FfmpegWriteTagsResponse {
  success?: boolean;
  error?: string;
}

export async function processFfmpegWriteTags(
  body: WriteTagsRequestBody
): Promise<FfmpegWriteTagsResponse> {
  const pathObj = new Path(body.path);
  const absolutePath = pathObj.platformAbsPath();

  try {
    const result = await writeMediaTags(absolutePath, body.tags);
    return result;
  } catch (error) {
    logger.error({ error, path: absolutePath }, 'Error writing media tags with ffmpeg');
    return {
      error: `Failed to write media tags: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    };
  }
}

export function handleFfmpegWriteTags(app: Hono) {
  app.post('/api/ffprobe/writeTags', async (c) => {
    try {
      const rawBody = await c.req.json();
      const parseResult = writeTagsRequestSchema.safeParse(rawBody);

      if (!parseResult.success) {
        const firstIssue = parseResult.error.issues[0];
        const message = firstIssue?.message ?? 'Invalid request body';
        return c.json({ error: message }, 400);
      }

      const body = parseResult.data;
      logger.info({ path: body.path, tags: Object.keys(body.tags) }, 'Writing media tags with ffmpeg');

      const result = await processFfmpegWriteTags(body);

      if (result.error) {
        return c.json(result, 400);
      }

      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'FfmpegWriteTags route error');
      return c.json(
        {
          error: 'Failed to process write tags request',
        },
        500
      );
    }
  });
}
