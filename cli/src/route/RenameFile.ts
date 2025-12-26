import { z } from 'zod';
import { Path } from '@core/path';
import type { FileRenameRequestBody, FileRenameResponseBody } from '@core/types';
import { validateSingleRenameOperation, executeRenameOperation, updateMediaMetadataAndBroadcast } from '../utils/renameFileUtils';

const dryRun: boolean = true;

const renameFileRequestSchema = z.object({
  mediaFolder: z.string().min(1, 'Media folder path is required'),
  from: z.string().min(1, 'Source file path is required'),
  to: z.string().min(1, 'Destination file path is required'),
});

export async function handleRenameFile(body: FileRenameRequestBody, clientId?: string): Promise<FileRenameResponseBody> {
  try {
    // Validate request body
    const validationResult = renameFileRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return {
        error: `Validation Failed: ${validationResult.error.issues.map(i => i.message).join(', ')}`,
      };
    }

    const { mediaFolder, from, to } = validationResult.data;

    // Validate the rename operation
    const validationResult2 = await validateSingleRenameOperation(from, to, mediaFolder);
    if (!validationResult2.isValid) {
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
      return {
        error: `Rename Failed: ${renameResult.error}`,
      };
    }

    // Update media metadata and broadcast if not dry run
    if (!dryRun) {
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

