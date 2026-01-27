import { z } from 'zod/v3';
import path from 'path';
import { mkdir, appendFile } from 'fs/promises';
import { validatePathIsInAllowlist } from './path-validator';
import { Path } from '@core/path';
import { existedFileError, isError, ExistedFileError } from '@core/errors';
import type { WriteFileRequestBody, WriteFileResponseBody } from '@core/types';
import type { Hono } from 'hono';
import { logger, logHttpIn, logHttpOut } from '../../lib/logger';

const writeFileRequestSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  mode: z.enum(['overwrite', 'append', 'create']),
  data: z.string(),
});

export async function doWriteFile(body: WriteFileRequestBody, traceId: string = ''): Promise<WriteFileResponseBody> {
  try {
    logger.info({ traceId }, `doWriteFile: Starting file write operation`);

    // Validate request body
    const validationResult = writeFileRequestSchema.safeParse(body);

    if (!validationResult.success) {
      logger.error({ traceId, error: validationResult.error }, `doWriteFile: Validation failed`);
      return {
        error: `Validation failed: ${validationResult.error.issues.map(i => i.message).join(', ')}`,
      };
    }

    const { path: filePath, mode, data } = validationResult.data;

    logger.debug({ traceId, filePath, mode, dataSize: data.length }, 
      `doWriteFile: Processing write request`);

    // Resolve to absolute path first, then convert to POSIX format for validation
    const resolvedPath = path.resolve(filePath);
    const posixPath = Path.posix(resolvedPath);

    // Validate path is in allowlist
    const isAllowed = await validatePathIsInAllowlist(posixPath);
    if (!isAllowed) {
      logger.warn({ traceId, filePath }, `doWriteFile: Path not in allowlist`);
      return {
        error: `Path "${filePath}" is not in allowlist`,
      };
    }

    // Use the resolved path for file operations
    const validatedPath = resolvedPath;

    // Ensure parent directory exists
    const parentDir = path.dirname(validatedPath);
    try {
      await mkdir(parentDir, { recursive: true });
      logger.debug({ traceId, parentDir }, `doWriteFile: Parent directory ensured`);
    } catch (error) {
      logger.warn({ traceId, error }, `doWriteFile: Failed to ensure parent directory`);
    }

    // Handle different modes
    if (mode === 'create') {
      logger.debug({ traceId, path: validatedPath }, `doWriteFile: Create mode`);
      // Check if file already exists
      const file = Bun.file(validatedPath);
      const exists = await file.exists();
      if (exists) {
        logger.error({ traceId, path: validatedPath }, `doWriteFile: File already exists`);
        return {
          error: existedFileError(validatedPath),
        };
      }

      // Write file using Bun's file API
      try {
        await Bun.write(validatedPath, data);
        logger.info({ traceId, path: validatedPath, size: data.length }, 
          `doWriteFile: File written successfully (create mode)`);
        return {}; // Success
      } catch (error) {
        logger.error({ traceId, path: validatedPath, error }, 
          `doWriteFile: Failed to write file (create mode)`);
        return {
          error: `Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    } else if (mode === 'overwrite') {
      logger.debug({ traceId, path: validatedPath }, `doWriteFile: Overwrite mode`);
      try {
        await Bun.write(validatedPath, data);
        logger.info({ traceId, path: validatedPath, size: data.length }, 
          `doWriteFile: File written successfully (overwrite mode)`);
        return {}; // Success
      } catch (error) {
        logger.error({ traceId, path: validatedPath, error }, 
          `doWriteFile: Failed to write file (overwrite mode)`);
        return {
          error: `Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    } else if (mode === 'append') {
      logger.debug({ traceId, path: validatedPath }, `doWriteFile: Append mode`);
      try {
        await appendFile(validatedPath, data, 'utf-8');
        logger.info({ traceId, path: validatedPath, appendedSize: data.length }, 
          `doWriteFile: Data appended successfully`);
        return {}; // Success
      } catch (error) {
        logger.error({ traceId, path: validatedPath, error }, 
          `doWriteFile: Failed to append to file`);
        return {
          error: `Failed to append to file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    } else {
      logger.error({ traceId, mode }, `doWriteFile: Invalid mode`);
      return {
        error: `Invalid mode: ${mode}`,
      };
    }
  } catch (error) {
    logger.error({ traceId, error }, `doWriteFile: Unexpected error`);
    return {
      error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export function handleWriteFile(app: Hono) {
  app.post('/api/writeFile', async (c) => {
    // Extract full trace ID from header (string with event name, e.g., "AiSettings-1294")
    const traceId = c.req.header('X-Trace-Id') || '';

    // Extract numeric counter for backward compatibility
    const numericTraceId = parseInt(traceId, 10) || 0;

    try {
      const rawBody = await c.req.json();
      logHttpIn(c, rawBody);
      const result = await doWriteFile(rawBody, traceId);

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
      logHttpOut(c, result, 200);
      return c.json(result, 200);
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
