import type { Hono } from 'hono';
import { z } from 'zod/v3';
import {
  convertVideo,
  type ConvertFormat,
  type ConvertPreset,
} from '../../utils/Ffmpeg';
import { logger } from '../../../lib/logger';
import { Path } from '@core/path';

const convertFormatSchema = z.enum(['mp4h264', 'mp4h265', 'webm', 'mkv']);
const convertPresetSchema = z.enum(['quality', 'balanced', 'speed']);

export const convertRequestSchema = z.object({
  inputPath: z.string().min(1, 'input path is required'),
  outputPath: z.string().min(1, 'output path is required'),
  outputFormat: convertFormatSchema,
  preset: convertPresetSchema,
});

export type ConvertRequestBody = z.infer<typeof convertRequestSchema>;

export interface ConvertResponseData {
  success?: boolean;
  outputPath?: string;
  error?: string;
}

export async function processFfmpegConvert(
  body: ConvertRequestBody
): Promise<ConvertResponseData> {
  const inputPathObj = new Path(body.inputPath);
  const outputPathObj = new Path(body.outputPath);
  const absoluteInput = inputPathObj.platformAbsPath();
  const absoluteOutput = outputPathObj.platformAbsPath();

  try {
    const result = await convertVideo(absoluteInput, absoluteOutput, {
      format: body.outputFormat as ConvertFormat,
      preset: body.preset as ConvertPreset,
    });

    if (result.error) {
      return { error: result.error };
    }

    return { success: true, outputPath: absoluteOutput };
  } catch (error) {
    logger.error(
      { error, inputPath: absoluteInput, outputPath: absoluteOutput },
      'Error converting video with ffmpeg'
    );
    return {
      error: `Failed to convert video: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    };
  }
}

export function handleFfmpegConvert(app: Hono) {
  app.post('/api/ffmpeg/convert', async (c) => {
    try {
      const rawBody = await c.req.json();
      const parseResult = convertRequestSchema.safeParse(rawBody);

      if (!parseResult.success) {
        const firstIssue = parseResult.error.issues[0];
        const message = firstIssue?.message ?? 'Invalid request body';
        return c.json({ error: message }, 400);
      }

      const body = parseResult.data;
      logger.info(
        { inputPath: body.inputPath, outputFormat: body.outputFormat, preset: body.preset },
        'Converting video with ffmpeg'
      );

      const result = await processFfmpegConvert(body);

      if (result.error) {
        return c.json(result, 400);
      }

      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'FfmpegConvert route error');
      return c.json(
        {
          error: 'Failed to process convert request',
        },
        500
      );
    }
  });
}
