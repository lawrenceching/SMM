import { z } from 'zod';
import { getUserDataDir } from '@/utils/config';
import { validatePathInUserDataDir } from './path-validator';
import type { ReadFileRequestBody, ReadFileResponseBody } from '@core/types';
import type { Hono } from 'hono';
import { logger } from '../../lib/logger';


const readFileRequestSchema = z.object({
  path: z.string().min(1, 'Path is required'),
});

export async function processReadFile(body: ReadFileRequestBody): Promise<ReadFileResponseBody> {
  try {
    // Validate request body
    const validationResult = readFileRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return {
        error: `Validation failed: ${validationResult.error.issues.map(i => i.message).join(', ')}`,
      };
    }

    const { path: filePath } = validationResult.data;
    const userDataDir = getUserDataDir();
    console.log(`userDataDir: ${userDataDir}`)
    
    // Validate path is within user data dir
    let validatedPath: string;
    try {
      validatedPath = validatePathInUserDataDir(filePath, userDataDir);
    } catch (error) {
      console.log(`invalid path: ${filePath}`)
      return {
        error: error instanceof Error ? error.message : 'Path validation failed',
      };
    }

    // Read file using Bun's file API
    try {
      const file = Bun.file(validatedPath);
      const exists = await file.exists();
      
      if (!exists) {
        return {
          error: `File not found: ${filePath}`,
        };
      }

      const data = await file.text();
      return {
        data,
      };
    } catch (error) {
      return {
        error: `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  } catch (error) {
    return {
      error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export function handleReadFile(app: Hono) {
  app.post('/api/readFile', async (c) => {
    try {
      const rawBody = await c.req.json();
      const result = await processReadFile(rawBody);
      
      // If there's an error, return 400, otherwise 200
      if (result.error) {
        return c.json(result, 400);
      }
      return c.json(result);
    } catch (error) {
      logger.error({ error }, 'ReadFile route error:');
      return c.json({ 
        error: 'Failed to process read file request',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });
}

