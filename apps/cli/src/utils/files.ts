import { Path } from "@core/path";
import { readdir, stat, unlink, access, constants, mkdir, cp } from "node:fs/promises";
import path from "path";
import { isDesktopEnv } from "./os";
import { logger } from "../../lib/logger";

/**
 * Lists files in a directory with optional recursive scanning and hidden file filtering
 * @param folderPath
 * @param recursively - Whether to scan subdirectories recursively
 * @param ignoreHiddenFiles - Whether to filter out hidden files and system files
 * @returns Promise<string[]> - List of file absolute paths in POSIX format
 */
export async function listFiles(_folderPath: Path, recursively: boolean = false, ignoreHiddenFiles: boolean = true): Promise<string[]> {
    let files: string[] = []
  
    const folderPlatformPath = _folderPath.platformAbsPath();
    
    async function scanDirectory(dirPath: string): Promise<void> {
      const items = await readdir(dirPath)
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item)
        const stats = await stat(fullPath)
        
        if (stats.isFile()) {
          files.push(Path.posix(fullPath))
        } else if (recursively && stats.isDirectory()) {
          await scanDirectory(fullPath)
        }
      }
    }
    
    await scanDirectory(folderPlatformPath)
  
    if (ignoreHiddenFiles) {
      files = files
        .map(file => {
          return {
            path: file,
            filename: path.basename(file),
            dirname: path.dirname(file)
          }
        })
        .filter(file => {
          const { filename, dirname } = file
          
          // Unix/Linux/macOS hidden files (starting with .)
          if (filename.startsWith('.')) return false
          
          // Windows system files
          if (filename === 'Thumbs.db' || filename === 'desktop.ini') return false
          
          // macOS system files
          if (filename === '.DS_Store' || filename === '.Spotlight-V100' || filename === '.Trashes') return false
          if (filename === '._.DS_Store' || filename === '.fseventsd') return false
          
          // Linux system files
          if (filename === '.Trash-1000' || filename === '.nfs') return false
          
          // Temporary and cache files
          if (filename.endsWith('.tmp') || filename.endsWith('.temp')) return false
          if (filename.endsWith('.cache') || filename.endsWith('.bak')) return false
          if (filename.endsWith('.swp') || filename.endsWith('.swo')) return false
          if (filename.endsWith('.lock') || filename.endsWith('.pid')) return false
          
          // BitComet padding files (already present in original code)
          if (filename.startsWith('_____padding_file') && filename.endsWith('____')) return false
          
          // uTorrent/BitTorrent files
          if (filename.endsWith('.torrent')) return false
          if (filename.endsWith('.part') || filename.endsWith('.part.1')) return false
          
          // Media player cache files
          // if (filename.endsWith('.nfo') && filename !== 'tvshow.nfo' && filename !== 'movie.nfo') return false
          // if (filename.endsWith('.srt') || filename.endsWith('.ass') || filename.endsWith('.ssa')) return false
          // if (filename.endsWith('.idx') || filename.endsWith('.sub')) return false
          
          // Archive and compression files (often temporary)
          if (filename.endsWith('.zip.tmp') || filename.endsWith('.rar.tmp')) return false
          if (filename.endsWith('.7z.tmp') || filename.endsWith('.tar.tmp')) return false
          
          // Log files
          if (filename.endsWith('.log') || filename.endsWith('.log.1')) return false
          
          // Backup files
          if (filename.endsWith('.backup') || filename.endsWith('.old')) return false
          
          // Hidden files in subdirectories (check if any parent directory is hidden)
          const pathParts = dirname.split(path.sep)
          for (const part of pathParts) {
            if (part.startsWith('.') && part !== '.') return false
          }
          
          return true
        })
        .map(file => file.path)
    }
  
    return files
  }
  
  /**
   * Move file to trash or delete it based on the current environment
   * - Desktop environments (Windows, macOS, Linux with DISPLAY): Move to system trash/recycle bin
   * - Server environments (Docker containers, headless Linux): Permanently delete file
   * 
   * @param filePath - The absolute path to the file to move/delete (in platform-specific format)
   * @throws {Error} If file doesn't exist, is inaccessible, or operation fails
   * 
   * @example
   * ```typescript
   * await moveFileToTrashOrDelete('/path/to/file.txt')
   * // Desktop: File moves to system trash
   * // Server: File is permanently deleted
   * ```
   */
  export async function moveFileToTrashOrDelete(filePath: string): Promise<void> {
    const platform = process.platform;
    
    try {
      await access(filePath, constants.F_OK | constants.R_OK);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}`);
      }
      if ((error as NodeJS.ErrnoException).code === 'EACCES') {
        throw new Error(`Permission denied: Cannot access file ${filePath}`);
      }
      throw new Error(`Cannot access file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) {
      throw new Error(`Path is not a file: ${filePath}`);
    }

    const isDesktop = isDesktopEnv();
    
    if (isDesktop) {
      logger.info({ filePath, platform, operation: 'move_to_trash' }, 'Moving file to system trash');
      await moveToTrash(filePath, platform);
    } else {
      logger.info({ filePath, platform, operation: 'permanent_delete' }, 'Permanently deleting file (server environment)');
      await permanentlyDelete(filePath);
    }
  }

  async function moveToTrash(filePath: string, platform: NodeJS.Platform): Promise<void> {
    try {
      switch (platform) {
        case 'win32':
          await moveToTrashWindows(filePath);
          break;
        case 'darwin':
          await moveToTrashMacOS(filePath);
          break;
        case 'linux':
          await moveToTrashLinux(filePath);
          break;
        default:
          logger.warn({ platform }, 'Unsupported platform for trash operation, falling back to permanent delete');
          await permanentlyDelete(filePath);
      }
    } catch (error) {
      logger.error({ filePath, platform, error }, 'Failed to move file to trash, attempting permanent delete');
      await permanentlyDelete(filePath);
    }
  }

  async function moveToTrashWindows(filePath: string): Promise<void> {
    const shell = require('shelljs');
    
    try {
      const escapedPath = filePath.replace(/"/g, '""');
      const command = `PowerShell -Command "Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile('${escapedPath}', 'OnlyErrorDialogs', 'SendToRecycleBin')"`;
      
      const result = shell.exec(command, { silent: true });
      
      if (result.code !== 0) {
        throw new Error(`PowerShell command failed with code ${result.code}: ${result.stderr}`);
      }
    } catch (error) {
      throw new Error(`Failed to move file to Windows Recycle Bin: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function moveToTrashMacOS(filePath: string): Promise<void> {
    const shell = require('shelljs');
    
    try {
      const escapedPath = filePath.replace(/'/g, "\\'").replace(/"/g, '\\"');
      const command = `osascript -e 'tell application "Finder" to delete POSIX file "${escapedPath}"'`;
      
      const result = shell.exec(command, { silent: true });
      
      if (result.code !== 0) {
        throw new Error(`osascript command failed with code ${result.code}: ${result.stderr}`);
      }
    } catch (error) {
      throw new Error(`Failed to move file to macOS Trash: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function moveToTrashLinux(filePath: string): Promise<void> {
    const homeDir = require('os').homedir();
    const xdgDataHome = process.env.XDG_DATA_HOME || path.join(homeDir, '.local', 'share');
    const trashDir = path.join(xdgDataHome, 'Trash');
    const trashInfoDir = path.join(xdgDataHome, 'Trash', 'info');
    const trashFilesDir = path.join(xdgDataHome, 'Trash', 'files');

    try {
      await ensureDirectoryExists(trashInfoDir);
      await ensureDirectoryExists(trashFilesDir);
    } catch (error) {
      throw new Error(`Failed to create trash directories: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const fileName = path.basename(filePath);
    const uniqueFileName = await getUniqueFileName(trashFilesDir, fileName);
    const trashFileDest = path.join(trashFilesDir, uniqueFileName);
    const trashInfoDest = path.join(trashInfoDir, `${uniqueFileName}.trashinfo`);

    const fileStats = await stat(filePath);
    const deletionDate = new Date().toISOString();
    
    const trashInfoContent = `[Trash Info]
Path=${encodeURIComponent(filePath)}
DeletionDate=${deletionDate}
`;

    try {
      await Bun.write(trashInfoDest, trashInfoContent);
      await cp(filePath, trashFileDest);
      await unlink(filePath);
    } catch (error) {
      try {
        await unlink(trashInfoDest);
      } catch (cleanupError) {
        logger.warn({ error: cleanupError }, 'Failed to cleanup trash info file after error');
      }
      throw new Error(`Failed to move file to Linux Trash: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function permanentlyDelete(filePath: string): Promise<void> {
    try {
      await unlink(filePath);
      logger.info({ filePath }, 'File permanently deleted');
    } catch (error) {
      const errorCode = (error as NodeJS.ErrnoException).code;
      
      if (errorCode === 'ENOENT') {
        throw new Error(`File not found: ${filePath}`);
      }
      if (errorCode === 'EACCES' || errorCode === 'EPERM') {
        throw new Error(`Permission denied: Cannot delete file ${filePath}`);
      }
      
      throw new Error(`Failed to delete file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await access(dirPath, constants.F_OK);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        await mkdir(dirPath, { recursive: true });
      } else {
        throw error;
      }
    }
  }

  async function getUniqueFileName(dirPath: string, baseName: string): Promise<string> {
    let counter = 0;
    let fileName = baseName;
    const ext = path.extname(baseName);
    const nameWithoutExt = path.basename(baseName, ext);
    
    while (true) {
      const fullPath = path.join(dirPath, fileName);
      
      try {
        await access(fullPath, constants.F_OK);
        counter++;
        fileName = `${nameWithoutExt}.${counter}${ext}`;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return fileName;
        }
        throw error;
      }
    }
  }