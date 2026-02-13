import { z } from 'zod/v3';
import type { RenameFilesRequestBody, RenameFilesResponseBody } from '@core/types';
import { executeRenameOperation } from '../utils/renameFileUtils';
import type { Hono } from 'hono';
import { logger } from '../../lib/logger';
import { validateRenameFilesRequest } from '../validations/validateRenameFilesApi';

const requestSchema = z.object({
  files: z
    .array(
      z.object({
        from: z.string().min(1, 'from is required'),
        to: z.string().min(1, 'to is required'),
      }),
    )
    .min(1, 'At least one file rename is required'),
  traceId: z.string().optional(),
});

export async function processRenameFiles(
  body: RenameFilesRequestBody,
  _clientId?: string,
): Promise<RenameFilesResponseBody> {
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join(', ');
    return { error: `Validation Failed: ${msg}` };
  }

  const { files, traceId } = parsed.data;
  const logCtx = traceId ? { traceId } : {};

  const { valid, failed: validationFailed } = await validateRenameFilesRequest(files);

  const succeeded: string[] = [];
  const failed: Array<{ path: string; error: string }> = [...validationFailed];

  for (const { from, to } of valid) {
    const result = await executeRenameOperation(from, to, {
      dryRun: false,
      logPrefix: '[POST /api/renameFiles]',
    });
    if (result.success) {
      succeeded.push(from);
    } else {
      failed.push({ path: from, error: result.error ?? 'Unknown error' });
    }
  }

  logger.info(
    { ...logCtx, succeededCount: succeeded.length, failedCount: failed.length },
    '[POST /api/renameFiles] completed',
  );

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
      logger.error({ error }, '[POST /api/renameFiles] route error');
      return c.json(
        {
          error:
            'Unexpected Error: ' + (error instanceof Error ? error.message : 'Unknown error'),
        },
        200,
      );
    }
  });
}
