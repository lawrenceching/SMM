import { z } from 'zod/v3';
import { Path } from '@core/path';
import type { FileRenameRequestBody, FileRenameResponseBody, FileRenameInBatchRequestBody, FileRenameInBatchResponseBody } from '@core/types';
import { validateSingleRenameOperation, executeRenameOperation, updateMediaMetadataAndBroadcast, validateBatchRenameOperations, executeBatchRenameOperations } from '../utils/renameFileUtils';
import pino from 'pino';
import type { Hono } from 'hono';
import { logger } from '../../lib/logger';

const logger = pino();

const dryRun: boolean = false;

const renameFileRequestSchema = z.object({
  mediaFolder: z.string().min(1, 'Media folder path is required'),
  from: z.string().min(1, 'Source file path is required'),
  to: z.string().min(1, 'Destination file path is required'),
});

export async function processRenameFile(body: FileRenameRequestBody, clientId?: string): Promise<FileRenameResponseBody> {
  try {
    // Validate request body
    const validationResult = renameFileRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      logger.warn({
        errors: validationResult.error.issues.map(i => i.message),
        body
      }, '[handleRenameFile] Validation failed');
      return {
        error: `Validation Failed: ${validationResult.error.issues.map(i => i.message).join(', ')}`,
      };
    }

    const { mediaFolder, from, to } = validationResult.data;

    // Validate the rename operation
    const validationResult2 = await validateSingleRenameOperation(from, to, mediaFolder);
    if (!validationResult2.isValid) {
      logger.warn({
        from,
        to,
        mediaFolder,
        error: validationResult2.error
      }, '[handleRenameFile] Rename operation validation failed');
      return {
        error: validationResult2.error,
      };
    }

    // Perform the rename operation
    const renameResult = await executeRenameOperation(from, to, {
      dryRun,
      clientId,
      logPrefix: '[handleRenameFile]',
    });

    if (!renameResult.success) {
      logger.error({
        from,
        to,
        dryRun,
        error: renameResult.error
      }, '[handleRenameFile] Rename operation execution failed');
      return {
        error: `Rename Failed: ${renameResult.error}`,
      };
    }

    // Update media metadata and broadcast if not dry run
    if (!dryRun) {
      logger.info({
        from,
        to,
        mediaFolder,
        clientId
      }, '[handleRenameFile] Updating media metadata and broadcasting (not dry run)');
      const mediaFolderInPosix = Path.posix(mediaFolder);
      await updateMediaMetadataAndBroadcast(
        mediaFolderInPosix,
        [{ from, to }],
        {
          dryRun: false,
          clientId,
          logPrefix: '[handleRenameFile]',
        }
      );
      // Note: Metadata update failures are logged but don't fail the rename operation
    }

    return {}; // Success - no error
  } catch (error) {
    return {
      error: `Unexpected Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

const renameFileInBatchRequestSchema = z.object({
  mediaFolder: z.string().min(1, 'Media folder path is required'),
  files: z.array(z.object({
    from: z.string().min(1, 'Source file path is required'),
    to: z.string().min(1, 'Destination file path is required'),
  })).min(1, 'At least one file rename operation is required'),
});

export async function processRenameFileInBatch(body: FileRenameInBatchRequestBody, clientId?: string): Promise<FileRenameInBatchResponseBody> {
  try {
    // Validate request body
    const validationResult = renameFileInBatchRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      logger.warn({
        errors: validationResult.error.issues.map(i => i.message),
        body
      }, '[handleRenameFileInBatch] Validation failed');
      return {
        error: `Validation Failed: ${validationResult.error.issues.map(i => i.message).join(', ')}`,
      };
    }

    const { mediaFolder, files } = validationResult.data;

    // Validate all rename operations before executing any
    logger.info({
      mediaFolder,
      fileCount: files.length,
      clientId
    }, '[handleRenameFileInBatch] Starting batch validation');

    const validationResult2 = await validateBatchRenameOperations(files, mediaFolder);
    if (!validationResult2.isValid) {
      logger.warn({
        mediaFolder,
        fileCount: files.length,
        errorCount: validationResult2.errors?.length || 0,
        clientId
      }, '[handleRenameFileInBatch] Batch rename validation failed');
      return {
        error: `Validation Failed: ${validationResult2.errors?.join('; ') || 'Unknown validation error'}`,
      };
    }

    const validatedRenames = validationResult2.validatedRenames || [];
    if (validatedRenames.length === 0) {
      logger.warn({
        mediaFolder,
        fileCount: files.length,
        clientId
      }, '[handleRenameFileInBatch] No valid files to rename after validation');
      return {
        error: 'No valid files to rename after validation',
      };
    }

    // Perform all rename operations
    logger.info({
      mediaFolder,
      validatedCount: validatedRenames.length,
      clientId
    }, '[handleRenameFileInBatch] Starting batch rename execution');

    const renameResult = await executeBatchRenameOperations(validatedRenames, {
      dryRun,
      clientId,
      logPrefix: '[handleRenameFileInBatch]',
    });

    if (!renameResult.success) {
      logger.error({
        mediaFolder,
        totalFiles: files.length,
        failedCount: renameResult.errors?.length || 0,
        successfulCount: renameResult.successfulRenames?.length || 0,
        clientId
      }, '[handleRenameFileInBatch] Batch rename execution failed');
      return {
        error: `Rename Failed: ${renameResult.errors?.join('; ') || 'Unknown error'}`,
      };
    }

    const successfulRenames = renameResult.successfulRenames || [];
    if (successfulRenames.length === 0) {
      logger.warn({
        mediaFolder,
        clientId
      }, '[handleRenameFileInBatch] No files were successfully renamed');
      return {
        error: 'No files were successfully renamed',
      };
    }

    // Update media metadata and broadcast if not dry run
    if (!dryRun) {
      logger.info({
        mediaFolder,
        successfulCount: successfulRenames.length,
        clientId
      }, '[handleRenameFileInBatch] Updating media metadata and broadcasting (not dry run)');
      const mediaFolderInPosix = Path.posix(mediaFolder);
      await updateMediaMetadataAndBroadcast(
        mediaFolderInPosix,
        successfulRenames,
        {
          dryRun: false,
          clientId,
          logPrefix: '[handleRenameFileInBatch]',
        }
      );
      // Note: Metadata update failures are logged but don't fail the rename operation
    }

    logger.info({
      mediaFolder,
      successfulCount: successfulRenames.length,
      clientId
    }, '[handleRenameFileInBatch] Batch rename operation completed successfully');

    return {}; // Success - no error
  } catch (error) {
    return {
      error: `Unexpected Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export function handleRenameFile(app: Hono) {
  app.post('/api/renameFile', async (c) => {
    try {
      const rawBody = await c.req.json();
      const clientId = c.req.header('clientId');
      logger.info(`[HTTP_IN] ${c.req.method} ${c.req.url} ${rawBody.from} -> ${rawBody.to} (clientId: ${clientId || 'not provided'})`)
      const result = await processRenameFile(rawBody, clientId);
      
      // Always return 200 status code per API design guideline
      // Business errors are returned in the "error" field
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'RenameFile route error:');
      return c.json({ 
        error: 'Unexpected Error: Failed to process rename file request',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 200);
    }
  });

  app.post('/api/renameFileInBatch', async (c) => {
    try {
      const rawBody = await c.req.json();
      const clientId = c.req.header('clientId');
      const fileCount = rawBody.files?.length || 0;
      logger.info(`[HTTP_IN] ${c.req.method} ${c.req.url} ${fileCount} file(s) (clientId: ${clientId || 'not provided'})`)
      const result = await processRenameFileInBatch(rawBody, clientId);
      
      // Always return 200 status code per API design guideline
      // Business errors are returned in the "error" field
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'RenameFileInBatch route error:');
      return c.json({ 
        error: 'Unexpected Error: Failed to process batch rename file request',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 200);
    }
  });
}

