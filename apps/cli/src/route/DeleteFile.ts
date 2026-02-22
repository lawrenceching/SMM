import { z } from 'zod/v3';
import { stat } from 'node:fs/promises';
import { Path } from '@core/path';
import type { DeleteFileRequestBody, DeleteFileResponseBody } from '@core/types';
import type { Hono } from 'hono';
import { logger } from '../../lib/logger';
import { moveFileToTrashOrDelete } from '../utils/files';

const deleteFileRequestSchema = z.object({
  path: z.string().min(1, 'Path is required'),
});

export async function doDeleteFile(body: DeleteFileRequestBody): Promise<DeleteFileResponseBody> {
  try {
    const validationResult = deleteFileRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return {
        data: {
          path: body.path || '',
        },
        error: `Validation Failed: ${validationResult.error.issues.map(i => i.message).join(', ')}`,
      };
    }

    let { path: filePath } = validationResult.data;
    
    try {
      filePath = Path.toPlatformPath(filePath);
    } catch (error) {
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
    } catch (error) {
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
        error: `Delete File Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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

export function handleDeleteFile(app: Hono) {
  app.post('/api/deleteFile', async (c) => {
    try {
      const rawBody = await c.req.json();
      const result = await doDeleteFile(rawBody);
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'DeleteFile route error:');
      return c.json({ 
        data: {
          path: '',
        },
        error: `Unexpected Error: ${error instanceof Error ? error.message : 'Failed to process delete file request'}`,
      }, 200);
    }
  });
}
