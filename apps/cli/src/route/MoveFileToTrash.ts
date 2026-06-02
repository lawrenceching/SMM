import { z } from 'zod/v3';
import { stat } from 'node:fs/promises';
import { Path } from '@core/path';
import type { MoveFileToTrashRequestBody, MoveFileToTrashResponseBody } from '@core/types';
import type { Hono } from 'hono';
import { logger } from '../../lib/logger';
import { moveFileToTrashOrDelete } from '../utils/files';

const moveFileToTrashRequestSchema = z.object({
  path: z.string().min(1, 'Path is required'),
});

export async function doMoveFileToTrash(
  body: MoveFileToTrashRequestBody,
): Promise<MoveFileToTrashResponseBody> {
  try {
    const validationResult = moveFileToTrashRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return {
        data: {
          path: body.path || '',
        },
        error: `Validation Failed: ${validationResult.error.issues.map((i) => i.message).join(', ')}`,
      };
    }

    let { path: filePath } = validationResult.data;

    try {
      filePath = Path.toPlatformPath(filePath);
    } catch {
      // use path as provided
    }

    const validatedPath = filePath;

    try {
      const fileStats = await stat(validatedPath);
      if (fileStats.isDirectory()) {
        return {
          data: {
            path: validatedPath,
          },
          error: `Path Is Directory: ${filePath} is a directory, not a file`,
        };
      }
    } catch {
      return {
        data: {
          path: validatedPath,
        },
        error: `File Not Found: ${filePath} was not found`,
      };
    }

    try {
      await moveFileToTrashOrDelete(validatedPath);

      return {
        data: {
          path: validatedPath,
        },
      };
    } catch (error) {
      return {
        data: {
          path: validatedPath,
        },
        error: `Move File To Trash Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  } catch (error) {
    return {
      data: {
        path: '',
      },
      error: `Unexpected Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export function handleMoveFileToTrash(app: Hono) {
  app.post('/api/moveFileToTrash', async (c) => {
    try {
      const rawBody = await c.req.json();
      const result = await doMoveFileToTrash(rawBody);
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'MoveFileToTrash route error:');
      return c.json(
        {
          data: {
            path: '',
          },
          error: `Unexpected Error: ${error instanceof Error ? error.message : 'Failed to process move file to trash request'}`,
        },
        200,
      );
    }
  });
}
