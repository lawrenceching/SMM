import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import { existsSync } from 'fs';
import type { OpenInFileManagerRequestBody, OpenInFileManagerResponseBody } from '@core/types';
import type { Hono } from 'hono';

/**
 * Check if the process is running in a desktop environment
 * - Windows and macOS are always considered desktop environments
 * - Linux: checks for DISPLAY environment variable (X11/Wayland)
 */
function isDesktopEnvironment(): boolean {
  const platform = os.platform();
  
  // Windows and macOS are always desktop environments
  if (platform === 'win32' || platform === 'darwin') {
    return true;
  }
  
  // Linux: check for DISPLAY environment variable
  if (platform === 'linux') {
    return !!process.env.DISPLAY;
  }
  
  // Other platforms: assume not desktop
  return false;
}

/**
 * Open a folder in the system file manager
 * - Windows: uses cmd.exe /c start to ensure window gets focus
 * - macOS: uses open -R to reveal in Finder and bring to front
 * - Linux: uses xdg-open
 */
async function openFolderInFileManager(folderPath: string): Promise<void> {
  const platform = os.platform();
  const normalizedPath = path.resolve(folderPath);
  
  // Verify the path exists and is a directory
  if (!existsSync(normalizedPath)) {
    throw new Error(`Path does not exist: ${normalizedPath}`);
  }
  
  return new Promise((resolve, reject) => {
    let command: string;
    let args: string[];
    
    switch (platform) {
      case 'win32':
        // Windows: Use cmd.exe /c start "" "<path>" to ensure window gets focus
        // The start command is designed to bring windows to focus
        command = 'cmd.exe';
        args = ['/c', 'start', '', normalizedPath];
        break;
        
      case 'darwin':
        // macOS: Use open -R to reveal folder in Finder and bring it to front
        command = 'open';
        args = ['-R', normalizedPath];
        break;
        
      case 'linux':
        // Linux: xdg-open
        command = 'xdg-open';
        args = [normalizedPath];
        break;
        
      default:
        reject(new Error(`Unsupported platform: ${platform}`));
        return;
    }
    
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
    });
    
    child.on('error', (error) => {
      reject(new Error(`Failed to open file manager: ${error.message}`));
    });
    
    child.on('spawn', () => {
      // Successfully spawned, don't wait for it to exit
      child.unref();
      resolve();
    });
  });
}

export function handleOpenInFileManagerRequest(app: Hono) {
  app.post('/api/openInFileManager', async (c) => {
    const body = await c.req.json() as OpenInFileManagerRequestBody;
    console.log(`[OpenInFileManager] Opening folder: ${body.path}`);
    
    try {
      // Check if running in desktop environment
      if (!isDesktopEnvironment()) {
        const response: OpenInFileManagerResponseBody = {
          data: {
            path: body.path,
          },
          error: 'Not running in desktop environment. This operation requires a desktop environment.',
        };
        return c.json(response, 400);
      }
      
      // Validate path is provided
      if (!body.path || typeof body.path !== 'string') {
        const response: OpenInFileManagerResponseBody = {
          data: {
            path: body.path || '',
          },
          error: 'Path is required and must be a string',
        };
        return c.json(response, 400);
      }
      
      // Open the folder
      await openFolderInFileManager(body.path);
      
      const response: OpenInFileManagerResponseBody = {
        data: {
          path: body.path,
        },
      };
      return c.json(response);
    } catch (error) {
      const response: OpenInFileManagerResponseBody = {
        data: {
          path: body.path,
        },
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
      return c.json(response, 400);
    }
  });
}
