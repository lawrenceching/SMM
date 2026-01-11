import { z } from 'zod';
import path from 'path';
import { mkdir } from 'fs/promises';
import { validatePathIsInAllowlist } from './path-validator';
import { Path } from '@core/path';
import { existedFileError, isError, ExistedFileError } from '@core/errors';
import type { WriteFileRequestBody, WriteFileResponseBody } from '@core/types';
import type { Hono } from 'hono';
import { logger, logHttpIn, logHttpOut } from '../../lib/logger';


const writeFileRequestSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  data: z.string(),
});

export async function doWriteFile(body: WriteFileRequestBody): Promise<WriteFileResponseBody> {
  try {
    // Validate request body
    const validationResult = writeFileRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return {
        error: `Validation failed: ${validationResult.error.issues.map(i => i.message).join(', ')}`,
      };
    }

    const { path: filePath, data } = validationResult.data;

    // Resolve to absolute path first, then convert to POSIX format for validation
    const resolvedPath = path.resolve(filePath);
    const posixPath = Path.posix(resolvedPath);

    // Validate path is in allowlist
    const isAllowed = await validatePathIsInAllowlist(posixPath);
    if (!isAllowed) {
      return {
        error: `Path "${filePath}" is not in the allowlist`,
      };
    }

    // Use the resolved path for file operations
    const validatedPath = resolvedPath;

    // Check if file already exists
    const file = Bun.file(validatedPath);
    const exists = await file.exists();
    if (exists) {
      return {
        error: existedFileError(validatedPath),
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
      logHttpIn(c, rawBody);
      const result = await doWriteFile(rawBody);
      
      // If there's an error, check if it's a "file already exists" error
      if (result.error) {
        // Return 200 status if file already exists, otherwise 400
        if (isError(result.error, ExistedFileError)) {
          logHttpOut(c, result, 200);
          return c.json(result, 200);
        }
        logHttpOut(c, result, 400);
        return c.json(result, 400);
      }
      return c.json(result);
    } catch (error) {
      const respBody = { 
        error: 'Failed to process write file request',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
      logHttpOut(c, respBody, 500);
      return c.json(respBody, 500);
    }
  });
}

