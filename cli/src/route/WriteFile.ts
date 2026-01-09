import { z } from 'zod';
import path from 'path';
import { mkdir } from 'fs/promises';
import { getUserDataDir } from '@/utils/config';
import { validatePathInUserDataDir } from './path-validator';
import type { WriteFileRequestBody, WriteFileResponseBody } from '@core/types';
import type { Hono } from 'hono';
import { logger } from '../../lib/logger';


const writeFileRequestSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  data: z.string(),
});

export async function processWriteFile(body: WriteFileRequestBody): Promise<WriteFileResponseBody> {
  try {
    // Validate request body
    const validationResult = writeFileRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return {
        error: `Validation failed: ${validationResult.error.issues.map(i => i.message).join(', ')}`,
      };
    }

    const { path: filePath, data } = validationResult.data;
    const userDataDir = getUserDataDir();
    
    // Validate path is within user data dir
    let validatedPath: string;
    try {
      validatedPath = validatePathInUserDataDir(filePath, userDataDir);
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Path validation failed',
      };
    }

    // Ensure parent directory exists
    const parentDir = path.dirname(validatedPath);
    try {
      await mkdir(parentDir, { recursive: true });
    } catch (error) {
      // If directory already exists, that's fine - continue
      // If it's a different error, we'll catch it during write
    }

    // Write file using Bun's file API
    try {
      await Bun.write(validatedPath, data);
      return {}; // Success - no error
    } catch (error) {
      return {
        error: `Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  } catch (error) {
    return {
      error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export function handleWriteFile(app: Hono) {
  app.post('/api/writeFile', async (c) => {
    try {
      const rawBody = await c.req.json();
      logger.info(`[HTTP_IN] ${c.req.method} ${c.req.url} ${rawBody.path}`)
      const result = await processWriteFile(rawBody);
      
      // If there's an error, return 400, otherwise 200
      if (result.error) {
        return c.json(result, 400);
      }
      return c.json(result);
    } catch (error) {
      logger.error({ error }, 'WriteFile route error:');
      return c.json({ 
        error: 'Failed to process write file request',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });
}

