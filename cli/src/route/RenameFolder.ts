import { z } from 'zod';
import { Path } from '@core/path';
import type { FolderRenameRequestBody, FolderRenameResponseBody } from '@core/types';
import { rename } from 'fs/promises';
import pino from 'pino';
import { executeHelloTask } from 'tasks/HelloTask';
import { getUserConfig, renameFolderInUserConfig, writeUserConfig } from '@/utils/config';
import { renameMediaFolderInMediaMetadata } from '@/utils/mediaMetadataUtils';
import { deleteMediaMetadataFile, findMediaMetadata, writeMediaMetadata } from '@/utils/mediaMetadata';
import { broadcastMessage } from '@/utils/websocketManager';
import { rm } from 'fs';
import { unlink } from 'fs/promises';

const logger = pino();

const dryRun: boolean = false;

const renameFolderRequestSchema = z.object({
  from: z.string().min(1, 'Source folder path is required'),
  to: z.string().min(1, 'Destination folder path is required'),
});

export async function handleRenameFolder(body: FolderRenameRequestBody, clientId?: string): Promise<FolderRenameResponseBody> {
  try {
    const userConfig = await getUserConfig();
    
    if (!userConfig.folders.includes(body.from)) {
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
    
    await rename(from, to);


    broadcastMessage({
      event: 'mediaMetadataUpdated',
      data: {
        folderPath: to
      }
    });

    return {}; // Success - no error
  } catch (error) {
    return {
      error: `Unexpected Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

