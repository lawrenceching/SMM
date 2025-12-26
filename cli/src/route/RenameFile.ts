import { z } from 'zod';
import { mkdir, rename } from 'fs/promises';
import { Path } from '@core/path';
import type { FileRenameRequestBody, FileRenameResponseBody } from '@core/types';
import { validatePathWithinMediaFolder } from '../validations/validatePathWithinMediaFolder';
import { validateSourceFileExist } from '../validations/validateSourceFileExist';
import { validateDestFileNotExist } from '../validations/validateDestFileNotExist';
import { validateNoAbnormalPaths } from '../validations/validateNoAbnormalPaths';
import pino from 'pino';

const logger = pino();

const dryRun: boolean = true;

const renameFileRequestSchema = z.object({
  mediaFolder: z.string().min(1, 'Media folder path is required'),
  from: z.string().min(1, 'Source file path is required'),
  to: z.string().min(1, 'Destination file path is required'),
});

export async function handleRenameFile(body: FileRenameRequestBody): Promise<FileRenameResponseBody> {
  try {
    // Validate request body
    const validationResult = renameFileRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return {
        error: `Validation Failed: ${validationResult.error.issues.map(i => i.message).join(', ')}`,
      };
    }

    const { mediaFolder, from, to } = validationResult.data;

    // 1. Validate no abnormal paths (should be first)
    const abnormalPathErrors = validateNoAbnormalPaths([{ from, to }]);
    if (abnormalPathErrors.length > 0) {
      return {
        error: `Invalid Path: ${abnormalPathErrors.join('; ')}`,
      };
    }

    // 2. Validate paths are within media folder
    const pathWithinFolderResult = validatePathWithinMediaFolder(mediaFolder, [{ from, to }]);
    if (!pathWithinFolderResult.isValid) {
      const errorMessages = pathWithinFolderResult.invalidPaths.map(
        (invalidPath) => `Path Outside Media Folder: ${invalidPath.type === 'source' ? 'Source' : 'Destination'} path "${invalidPath.path}" is outside the media folder`
      );
      return {
        error: errorMessages.join('; '),
      };
    }

    // 3. Validate source file exists
    const sourceExistResult = await validateSourceFileExist([{ from, to }]);
    if (!sourceExistResult.isValid) {
      return {
        error: `File Not Found: Source file "${from}" does not exist`,
      };
    }

    // 4. Validate destination file does not exist
    const destNotExistResult = await validateDestFileNotExist([{ from, to }]);
    if (!destNotExistResult.isValid) {
      return {
        error: `File Already Exists: Destination file "${to}" already exists`,
      };
    }

    // 5. Perform the rename operation
    try {
      const fromPathPlatform = new Path(from).platformAbsPath();
      const toPathPlatform = new Path(to).platformAbsPath();

      // Ensure target directory exists
      // Handle case where file is at root level (parent() throws error)
      let toDirPlatform: string | null = null;
      try {
        const toDir = new Path(to).parent();
        toDirPlatform = toDir.platformAbsPath();
      } catch (error) {
        // If parent() throws "reaching parent folder is not allowed", 
        // it means the file is at root level, so no directory creation needed
        if (error instanceof Error && error.message === 'reaching parent folder is not allowed') {
          toDirPlatform = null; // File is at root, no directory to create
        } else {
          throw error; // Re-throw if it's a different error
        }
      }

      if(dryRun) {
        logger.info({
          from: fromPathPlatform,
          to: toPathPlatform
        }, '[handleRenameFile] Dry run: Would rename file from "${from}" to "${to}"');
      } else {
        // Create directory only if not at root level
        if (toDirPlatform !== null) {
          await mkdir(toDirPlatform, { recursive: true });
        }
        // Perform the rename
        await rename(fromPathPlatform, toPathPlatform);
      }

      return {}; // Success - no error
    } catch (error) {
      return {
        error: `Rename Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  } catch (error) {
    return {
      error: `Unexpected Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

