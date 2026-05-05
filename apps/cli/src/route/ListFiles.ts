import { z } from 'zod/v3';
import os from 'os';
import { readdir, stat } from 'node:fs/promises';
import path from 'path';
import { Path } from '@core/path';
import type { ListFilesRequestBody, ListFilesResponseBody } from '@core/types';
import type { Hono } from 'hono';
import { logger } from '../../lib/logger';

const listFilesRequestSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  onlyFiles: z.boolean().optional(),
  onlyFolders: z.boolean().optional(),
  includeHiddenFiles: z.boolean().optional(),
  recursively: z.boolean().optional(),
});

export async function doListFiles(body: ListFilesRequestBody): Promise<ListFilesResponseBody> {
  const requestId = `listFiles-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  logger.info({ requestId, body }, '[ListFiles] request received');

  try {
    // Validate request body
    const validationResult = listFilesRequestSchema.safeParse(body);

    if (!validationResult.success) {
      logger.info(
        { requestId, issues: validationResult.error.issues },
        '[ListFiles] validation failed'
      );
      return {
        data: {
          path: '',
          items: [],
          size: 0,
        },
        error: `Validation Failed: ${validationResult.error.issues.map(i => i.message).join(', ')}`,
      };
    }

    let { path: folderPath, onlyFiles, onlyFolders, includeHiddenFiles = false, recursively = false } = validationResult.data;
    logger.debug(
      { requestId, folderPath, onlyFiles, onlyFolders, includeHiddenFiles, recursively },
      '[ListFiles] validated params'
    );
    
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
      logger.info({ requestId, folderPath, error }, '[ListFiles] Path normalization threw, using path.resolve');
    }

    // Resolve to absolute path (no validation - all paths are allowed)
    const validatedPath = path.resolve(folderPath);
    logger.info({ requestId, validatedPath }, '[ListFiles] resolved absolute path');

    // Check if path exists and is a directory
    try {
      const stats = await stat(validatedPath);
      logger.info({ requestId, validatedPath, isDirectory: stats.isDirectory(), isFile: stats.isFile() }, '[ListFiles] stat result');
      if (!stats.isDirectory()) {
        logger.info({ requestId, validatedPath }, '[ListFiles] path is not a directory');
        return {
          data: {
            path: validatedPath,
            items: [],
            size: 0,
          },
          error: `Path Not Directory: ${folderPath} is not a directory`,
        };
      }
    } catch (error) {
      logger.info(
        { requestId, validatedPath, folderPath, errMessage: error instanceof Error ? error.message : String(error), errCode: error instanceof Error ? (error as NodeJS.ErrnoException).code : undefined },
        '[ListFiles] stat failed (path not found or not accessible)'
      );
      return {
        data: {
          path: validatedPath,
          items: [],
          size: 0,
        },
        error: `Directory Not Found: ${folderPath} was not found`,
      };
    }

    // List directory contents
    try {
      logger.debug({ requestId, validatedPath }, '[ListFiles] starting readdir');
      const results: Array<{ path: string; size: number; mtime: number; isDirectory: boolean }> = [];
      let totalCount = 0; // Count of all items in the immediate directory (before onlyFiles/onlyFolders filtering)

      async function scanDirectory(dirPath: string, isTopLevel: boolean = false): Promise<void> {
        logger.debug({ requestId, dirPath, isTopLevel }, '[ListFiles] scanDirectory readdir');
        const items = await readdir(dirPath);

        for (const item of items) {
          const fullPath = path.join(dirPath, item);

          try {
            const itemStats = await stat(fullPath);
            const isFile = itemStats.isFile();
            const isDirectory = itemStats.isDirectory();

            // Filter hidden files/directories if not including them
            const filename = path.basename(item);
            const isHidden = filename.startsWith('.') || filename === 'Thumbs.db' || filename === 'desktop.ini';
            
            if (!includeHiddenFiles && isHidden) {
              continue;
            }

            // Count items in the top-level directory only (before onlyFiles/onlyFolders filtering)
            if (isTopLevel) {
              totalCount++;
            }

            // Filter based on onlyFiles/onlyFolders to determine if we add to results
            // If both are true, onlyFiles takes precedence (per doc)
            let shouldAddToResults = true;
            if (onlyFiles && onlyFolders) {
              // Both are true: onlyFiles takes precedence, so only return files
              shouldAddToResults = isFile;
            } else {
              // Handle onlyFiles filter
              if (onlyFiles === true && !isFile) {
                shouldAddToResults = false;
              }
              // Handle onlyFolders filter
              // Note: onlyFolders: false means "don't filter to only folders" (return both)
              // onlyFolders: true means "only return folders"
              if (onlyFolders === true && !isDirectory) {
                shouldAddToResults = false;
              }
            }

            // Add to results if it passes the filters (use absolute path)
            if (shouldAddToResults) {
              results.push({
                path: fullPath,
                size: itemStats.size,
                mtime: itemStats.mtimeMs,
                isDirectory: isDirectory,
              });
            }

            // If it's a directory and recursively is true, scan it recursively
            // (even if we filtered it out from results)
            if (isDirectory && recursively) {
              await scanDirectory(fullPath, false);
            }
          } catch (error) {
            // Skip items we can't stat (permissions, etc.)
            continue;
          }
        }
      }

      await scanDirectory(validatedPath, true);

      return {
        data: {
          path: validatedPath,
          items: results,
          size: totalCount,
        },
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const errNo = (error as NodeJS.ErrnoException)?.code;
      logger.info(
        {
          requestId,
          validatedPath,
          errMessage: err.message,
          errCode: errNo,
          errStack: err.stack,
        },
        '[ListFiles] readdir/list failed (EPERM often means sandbox or Full Disk Access)'
      );
      return {
        data: {
          path: validatedPath,
          items: [],
          size: 0,
        },
        error: `List Directory Failed: ${err.message}`,
      };
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.info(
      { requestId, errMessage: err.message, errStack: err.stack },
      '[ListFiles] unexpected error in doListFiles'
    );
    return {
      data: {
        path: '',
        items: [],
        size: 0,
      },
      error: `Unexpected Error: ${err.message}`,
    };
  }
}

export function handleListFiles(app: Hono) {
  // GET /api/listFiles - supports query parameters
  app.get('/api/listFiles', async (c) => {
    const query = c.req.query();
    logger.info({ query }, '[ListFiles] GET /api/listFiles');
    try {
      const body: any = {
        path: query.path || '',
      };
      if (query.onlyFiles !== undefined) {
        body.onlyFiles = query.onlyFiles === 'true';
      }
      if (query.onlyFolders !== undefined) {
        body.onlyFolders = query.onlyFolders === 'true';
      }
      if (query.includeHiddenFiles !== undefined) {
        body.includeHiddenFiles = query.includeHiddenFiles === 'true';
      }
      if (query.recursively !== undefined) {
        body.recursively = query.recursively === 'true';
      }
      const result = await doListFiles(body);
      if (result.error) {
        logger.info({ body, resultError: result.error }, '[ListFiles] GET result has error');
      }
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'ListFiles GET route error');
      return c.json({ 
        data: {
          path: '',
          items: [],
          size: 0,
        },
        error: `Unexpected Error: ${error instanceof Error ? error.message : 'Failed to process list files request'}`,
      }, 200);
    }
  });

  // POST /api/listFiles - supports request body
  app.post('/api/listFiles', async (c) => {
    try {
      const rawBody = await c.req.json();
      logger.info({ rawBody }, '[ListFiles] POST /api/listFiles');
      const result = await doListFiles(rawBody);
      if (result.error) {
        logger.info({ rawBody, resultError: result.error }, '[ListFiles] POST result has error');
      }
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'ListFiles POST route error');
      return c.json({ 
        data: {
          path: '',
          items: [],
          size: 0,
        },
        error: `Unexpected Error: ${error instanceof Error ? error.message : 'Failed to process list files request'}`,
      }, 200);
    }
  });
}

