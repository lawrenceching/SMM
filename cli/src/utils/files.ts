import { Path } from "@core/path";
import { readdir, stat } from "node:fs/promises";
import path from "path";

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
  