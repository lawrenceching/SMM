import { z } from 'zod/v3';
import type { RenameFilesRequestBody, RenameFilesResponseBody } from '@core/types';
import { Path } from '@core/path';
import { executeBatchRenameOperations, updateMediaMetadataAndBroadcast } from '../utils/renameFileUtils';
import type { Hono } from 'hono';
import { logger } from '../../lib/logger';
import { getMediaFolder } from '../utils/getMediaFolder';
import { getUserConfig } from '@/utils/config';
import { validateRenameOperations } from '@/tools/renameFilesInBatch';

const requestSchema = z.object({
  files: z
    .array(
      z.object({
        from: z.string().min(1, 'The source file path, absolute path in platform-specific format'),
        to: z.string().min(1, 'The target file path, absolute path in platform-specific format'),
      }),
    )
    .min(1, 'At least one file rename is required'),
  traceId: z.string().optional(),
  mediaFolder: z.string().optional(),
  clientId: z.string().optional(),
});

export async function processRenameFiles(
  body: RenameFilesRequestBody,
  clientId?: string,
): Promise<RenameFilesResponseBody> {
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join(', ');
    return { error: `Validation Failed: ${msg}` };
  }

  const { files, traceId, mediaFolder: mediaFolderFromBody, clientId: clientIdFromBody } = parsed.data;
  const effectiveClientId = clientId ?? clientIdFromBody;

  if (files === undefined || files.length === 0) {
    return { error: 'At least one file rename is required' };
  }

  const logCtx = traceId ? { traceId } : {};

  const userConfig = await getUserConfig();
  const mediaFolderPath = mediaFolderFromBody ?? getMediaFolder(files[0]!.from, userConfig.folders);

  if (mediaFolderPath === null) {
    return { error: `Media folder not found for ${files[0]!.from}` };
  }

  const mediaFolderInPosix = Path.posix(mediaFolderPath);

  const validationResult = await validateRenameOperations(files, mediaFolderInPosix);

  if (!validationResult.isValid) {
    return { error: validationResult.errors.join(', ') };
  }

  const renameResult = await executeBatchRenameOperations(validationResult.validatedRenames, {
    dryRun: false,
    clientId: effectiveClientId,
    logPrefix: '[POST /api/renameFiles]',
  });

  const succeeded = (renameResult.successfulRenames ?? []).map((r) => r.from);
  const failed: Array<{ path: string; error: string }> = [];
  if (!renameResult.success && renameResult.errors) {
    for (const errMsg of renameResult.errors) {
      // Extract path from error message for compatibility with existing format
      const match = errMsg.match(/^Failed to rename "([^"]+)"/);
      failed.push({ path: match?.[1] ?? 'unknown', error: errMsg });
    }
  }

  logger.info(
    { ...logCtx, succeededCount: succeeded.length, failedCount: failed.length },
    '[POST /api/renameFiles] completed',
  );

  // If mediaFolder was provided, update metadata and broadcast in a single step
  if (renameResult.successfulRenames && renameResult.successfulRenames.length > 0) {
    await updateMediaMetadataAndBroadcast(mediaFolderInPosix, renameResult.successfulRenames, {
      clientId: effectiveClientId,
      logPrefix: '[POST /api/renameFiles]',
    });
  }

  return {
    data: {
      succeeded,
      failed,
    },
  };
}

export function handleRenameFiles(app: Hono): void {
  app.post('/api/renameFiles', async (c) => {
    try {
      const rawBody = await c.req.json();
      const clientId = c.req.header('clientId');
      const result = await processRenameFiles(rawBody as RenameFilesRequestBody, clientId ?? undefined);
      return c.json(result, 200);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error(
        { error: errorMessage, stack: errorStack },
        '[POST /api/renameFiles] route error',
      );
      return c.json(
        {
          error: 'Unexpected Error: ' + errorMessage,
        },
        200,
      );
    }
  });
}
