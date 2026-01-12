import { z } from 'zod';
import { Path } from '@core/path';
import type { FolderRenameRequestBody, FolderRenameResponseBody } from '@core/types';
import { rename } from 'fs/promises';
import { getUserConfig, renameFolderInUserConfig, writeUserConfig } from '@/utils/config';
import { renameMediaFolderInMediaMetadata } from '@/utils/mediaMetadataUtils';
import { deleteMediaMetadataFile, findMediaMetadata, writeMediaMetadata } from '@/utils/mediaMetadata';
import { broadcast } from '@/utils/socketIO';
import type { Hono } from 'hono';
import { logger } from '../../lib/logger';

const renameFolderRequestSchema = z.object({
  from: z.string().min(1, 'Source folder path is required, in POSIX format'),
  to: z.string().min(1, 'Destination folder path is required, in POSIX format'),
});

export async function doRenameFolder(body: FolderRenameRequestBody, clientId?: string): Promise<FolderRenameResponseBody> {
  try {
    const userConfig = await getUserConfig();
    
    if (!userConfig.folders.includes(Path.toPlatformPath(body.from))) {
      logger.error({
        from: body.from,
        to: body.to,
      }, '[handleRenameFolder] Source folder is not managed by SMM');
      return {
        error: `${body.from} is not managed by SMM`,
      };
    }

    // Validate request body
    const validationResult = renameFolderRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      logger.warn({
        errors: validationResult.error.issues.map(i => i.message),
        body
      }, '[handleRenameFolder] Validation failed');
      return {
        error: `Validation Failed: ${validationResult.error.issues.map(i => i.message).join(', ')}`,
      };
    }

    const { from, to } = validationResult.data;

    const mediaMetadata = await findMediaMetadata(from);
    if(!mediaMetadata) {
      logger.error({
        from,
        to,
      }, '[handleRenameFolder] Media metadata not found');
      return {
        error: `Media metadata not found: ${from}`,
      };
    }

    const mm = await renameMediaFolderInMediaMetadata(mediaMetadata, from, to);
    logger.info({
      mm,
    }, '[handleRenameFolder] Renamed media folder in media metadata');
    await writeMediaMetadata(mm);
    deleteMediaMetadataFile(from);
    logger.info({
      file: from,
    }, '[handleRenameFolder] Deleted source file');

    const newUserConfig = renameFolderInUserConfig(userConfig, from, to);
    logger.info({
      userConfig: newUserConfig,
    }, '[handleRenameFolder] Renamed folder in user config');
    await writeUserConfig(newUserConfig);
    
    await rename(Path.toPlatformPath(from), Path.toPlatformPath(to));

    broadcast({
      clientId: clientId,
      event: 'userConfigUpdated',
      data: {}
    });

    return {}; // Success - no error
  } catch (error) {
    return {
      error: `Unexpected Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export function handleRenameFolder(app: Hono) {
  app.post('/api/renameFolder', async (c) => {
    try {
      const rawBody = await c.req.json();
      const clientId = c.req.header('clientId');
      logger.info(`[HTTP_IN] ${c.req.method} ${c.req.url} ${rawBody.from} -> ${rawBody.to} (clientId: ${clientId || 'not provided'})`)
      const result = await doRenameFolder(rawBody, clientId);
      
      // Always return 200 status code per API design guideline
      // Business errors are returned in the "error" field
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'RenameFolder route error:');
      return c.json({ 
        error: 'Unexpected Error: Failed to process rename folder request',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 200);
    }
  });
}

