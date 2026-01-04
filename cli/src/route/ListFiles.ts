import { z } from 'zod';
import os from 'os';
import { readdir, stat } from 'node:fs/promises';
import path from 'path';
import { Path } from '@core/path';
import type { ListFilesRequestBody, ListFilesResponseBody } from '@core/types';

const listFilesRequestSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  onlyFiles: z.boolean().optional(),
  onlyFolders: z.boolean().optional(),
  includeHiddenFiles: z.boolean().optional(),
});

export async function handleListFiles(body: ListFilesRequestBody): Promise<ListFilesResponseBody> {
  try {
    // Validate request body
    const validationResult = listFilesRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return {
        data: [],
        error: `Validation Failed: ${validationResult.error.issues.map(i => i.message).join(', ')}`,
      };
    }

    let { path: folderPath, onlyFiles, onlyFolders, includeHiddenFiles = false } = validationResult.data;
    
    // Resolve "~" to user home directory
    if (folderPath === '~' || folderPath.startsWith('~/')) {
      const homeDir = os.homedir();
      if (folderPath === '~') {
        folderPath = homeDir;
      } else {
        // Handle "~/path/to/something"
        folderPath = path.join(homeDir, folderPath.slice(2));
      }
    }
    
    // Normalize path using Path class to handle POSIX-style Windows paths
    // Convert to platform-specific format (e.g., /C/Users/... -> C:\Users\... on Windows)
    try {
      // Check if it's a POSIX-style path (starts with /)
      if (folderPath.startsWith('/') && Path.isWindows()) {
        // Normalize /C:/Users/... to /C/Users/... format (Path.win expects /C/Users/...)
        const normalizedPosixPath = folderPath.replace(/^\/([A-Za-z]):\//, '/$1/');
        // Use Path.win() to convert POSIX path to Windows format
        folderPath = Path.win(normalizedPosixPath);
      } else if (/^[A-Za-z]:/.test(folderPath) && !Path.isWindows()) {
        // If it's a Windows path on non-Windows, convert to POSIX
        const pathObj = new Path(folderPath);
        folderPath = pathObj.abs('posix');
      } else {
        // Try to use Path.toPlatformPath() for other cases
        folderPath = Path.toPlatformPath(folderPath);
      }
    } catch (error) {
      // If Path operations fail (e.g., relative path, invalid format), 
      // use path.resolve directly - it handles relative paths and other edge cases
    }
    
    // Resolve to absolute path (no validation - all paths are allowed)
    const validatedPath = path.resolve(folderPath);

    // Check if path exists and is a directory
    try {
      const stats = await stat(validatedPath);
      if (!stats.isDirectory()) {
        return {
          data: [],
          error: `Path Not Directory: ${folderPath} is not a directory`,
        };
      }
    } catch (error) {
      return {
        data: [],
        error: `Directory Not Found: ${folderPath} was not found`,
      };
    }

    // List directory contents
    try {
      const items = await readdir(validatedPath);
      const results: string[] = [];

      for (const item of items) {
        const fullPath = path.join(validatedPath, item);
        
        try {
          const itemStats = await stat(fullPath);
          const isFile = itemStats.isFile();
          const isDirectory = itemStats.isDirectory();

          // Filter based on onlyFiles/onlyFolders
          // If both are true, onlyFiles takes precedence (per doc)
          if (onlyFiles && onlyFolders) {
            // Both are true: onlyFiles takes precedence, so only return files
            if (!isFile) continue;
          } else {
            // Handle onlyFiles filter
            if (onlyFiles === true && !isFile) continue;
            // Handle onlyFolders filter
            // Note: onlyFolders: false means "don't filter to only folders" (return both)
            // onlyFolders: true means "only return folders"
            if (onlyFolders === true && !isDirectory) continue;
          }

          // Filter hidden files if not including them
          if (!includeHiddenFiles) {
            const filename = path.basename(item);
            // Unix/Linux/macOS hidden files (starting with .)
            if (filename.startsWith('.')) continue;
            // Windows system files
            if (filename === 'Thumbs.db' || filename === 'desktop.ini') continue;
          }

          // Add to results (use absolute path)
          results.push(fullPath);
        } catch (error) {
          // Skip items we can't stat (permissions, etc.)
          continue;
        }
      }

      return {
        data: results,
      };
    } catch (error) {
      return {
        data: [],
        error: `List Directory Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  } catch (error) {
    return {
      data: [],
      error: `Unexpected Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

