import { z } from 'zod/v3';
import { stat } from 'node:fs/promises';
import path from 'path';
import { isManagedYtdlpCookiesPath } from '@core/whitelistedCmd/ytdlpCookies';
import type { DeleteFileRequestBody, DeleteFileResponseBody } from '@core/types';
import type { Hono } from 'hono';
import { getUserDataDir } from '@/utils/config';
import { logger } from '../../lib/logger';
import { permanentlyDeleteFile } from '../utils/files';

const deleteFileRequestSchema = z.object({
  path: z.string().min(1, 'Path is required'),
});

export async function doDeleteFile(body: DeleteFileRequestBody): Promise<DeleteFileResponseBody> {
  try {
    const validationResult = deleteFileRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return {
        error: `Validation Failed: ${validationResult.error.issues.map((i) => i.message).join(', ')}`,
      };
    }

    let filePath = validationResult.data.path;
    const resolvedPath = path.resolve(filePath);
    const userDataDir = path.resolve(getUserDataDir());

    if (!isManagedYtdlpCookiesPath(resolvedPath, userDataDir)) {
      logger.warn({ filePath: resolvedPath }, '[deleteFile] rejected path outside managed cookies allowlist');
      return {
        error: 'Path is not an allowed managed yt-dlp cookies file',
      };
    }

    try {
      const fileStats = await stat(resolvedPath);
      if (!fileStats.isFile()) {
        return {
          error: `Path Is Directory: ${filePath} is a directory, not a file`,
        };
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.info({ filePath: resolvedPath }, '[deleteFile] file already absent');
        return { data: { path: resolvedPath } };
      }
      return {
        error: `Cannot access file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }

    try {
      await permanentlyDeleteFile(resolvedPath);
      return { data: { path: resolvedPath } };
    } catch (error) {
      logger.error({ filePath: resolvedPath, error }, '[deleteFile] permanent delete failed');
      return {
        error: `Delete File Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  } catch (error) {
    return {
      error: `Unexpected Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export function handleDeleteFile(app: Hono) {
  app.post('/api/deleteFile', async (c) => {
    try {
      const rawBody = await c.req.json();
      const result = await doDeleteFile(rawBody);
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'DeleteFile route error');
      return c.json(
        {
          error: `Unexpected Error: ${error instanceof Error ? error.message : 'Failed to process delete file request'}`,
        },
        200,
      );
    }
  });
}
