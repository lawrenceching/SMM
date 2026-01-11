import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import type { ListFilesRequestBody } from '@core/types';
import { mkdir, writeFile, rm, stat } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { processListFiles } from './ListFiles';

describe('processListFiles', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    testDir = join(tmpdir(), `smm-listfiles-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('validation', () => {
    it('should return error when path is empty', async () => {
      const request: ListFilesRequestBody = {
        path: '',
      };

      const result = await processListFiles(request);

      expect(result.data.items).toEqual([]);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Validation Failed');
      expect(result.error).toContain('Path is required');
    });

    it('should return error when path is missing', async () => {
      const request = {} as ListFilesRequestBody;

      const result = await processListFiles(request);

      expect(result.data.items).toEqual([]);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Validation Failed');
    });
  });

  describe('path resolution', () => {
    it('should resolve "~" to user home directory', async () => {
      // Create a file in home directory for testing
      const homeDir = require('os').homedir();
      const testFile = join(homeDir, 'test-listfiles.txt');
      
      try {
        await writeFile(testFile, 'test content', 'utf-8');

        const request: ListFilesRequestBody = {
          path: '~',
        };

        const result = await processListFiles(request);

        expect(result.error).toBeUndefined();
        expect(result.data.items).toContain(testFile);
      } finally {
        // Clean up
        try {
          await rm(testFile, { force: true });
        } catch {
          // Ignore
        }
      }
    });

    it('should resolve "~/path" to user home directory + path', async () => {
      // Create a subdirectory in home for testing
      const homeDir = require('os').homedir();
      const testSubDir = join(homeDir, 'smm-test-listfiles');
      const testFile = join(testSubDir, 'test.txt');
      
      try {
        await mkdir(testSubDir, { recursive: true });
        await writeFile(testFile, 'test content', 'utf-8');

        const request: ListFilesRequestBody = {
          path: '~/smm-test-listfiles',
        };

        const result = await processListFiles(request);

        expect(result.error).toBeUndefined();
        expect(result.data.items).toContain(testFile);
      } finally {
        // Clean up
        try {
          await rm(testSubDir, { recursive: true, force: true });
        } catch {
          // Ignore
        }
      }
    });
  });

  describe('error cases', () => {
    it('should return error when directory does not exist', async () => {
      const request: ListFilesRequestBody = {
        path: join(testDir, 'nonexistent'),
      };

      const result = await processListFiles(request);

      expect(result.data.items).toEqual([]);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Directory Not Found');
    });

    it('should return error when path is a file, not a directory', async () => {
      const testFile = join(testDir, 'test.txt');
      await writeFile(testFile, 'test content', 'utf-8');

      const request: ListFilesRequestBody = {
        path: testFile,
      };

      const result = await processListFiles(request);

      expect(result.data.items).toEqual([]);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Path Not Directory');
    });
  });

  describe('successful listing', () => {
    beforeEach(async () => {
      // Create test files and folders
      await writeFile(join(testDir, 'file1.txt'), 'content1', 'utf-8');
      await writeFile(join(testDir, 'file2.txt'), 'content2', 'utf-8');
      await mkdir(join(testDir, 'folder1'), { recursive: true });
      await mkdir(join(testDir, 'folder2'), { recursive: true });
    });

    it('should list all files and folders by default', async () => {
      const request: ListFilesRequestBody = {
        path: testDir,
      };

      const result = await processListFiles(request);

      expect(result.error).toBeUndefined();
      expect(result.data.items.length).toBe(4);
      expect(result.data.items).toContain(join(testDir, 'file1.txt'));
      expect(result.data.items).toContain(join(testDir, 'file2.txt'));
      expect(result.data.items).toContain(join(testDir, 'folder1'));
      expect(result.data.items).toContain(join(testDir, 'folder2'));
    });

    it('should return absolute paths', async () => {
      const request: ListFilesRequestBody = {
        path: testDir,
      };

      const result = await processListFiles(request);

      expect(result.error).toBeUndefined();
      result.data.items.forEach(path => {
        expect(path).toMatch(/^[A-Z]:\\|^\/|^\\\\/); // Windows drive, Unix root, or UNC
      });
    });

    it('should list only files when onlyFiles is true', async () => {
      const request: ListFilesRequestBody = {
        path: testDir,
        onlyFiles: true,
      };

      const result = await processListFiles(request);

      expect(result.error).toBeUndefined();
      expect(result.data.items.length).toBe(2);
      expect(result.data.items).toContain(join(testDir, 'file1.txt'));
      expect(result.data.items).toContain(join(testDir, 'file2.txt'));
      expect(result.data.items).not.toContain(join(testDir, 'folder1'));
      expect(result.data.items).not.toContain(join(testDir, 'folder2'));
    });

    it('should list only folders when onlyFolders is true', async () => {
      const request: ListFilesRequestBody = {
        path: testDir,
        onlyFolders: true,
      };

      const result = await processListFiles(request);

      expect(result.error).toBeUndefined();
      expect(result.data.items.length).toBe(2);
      expect(result.data.items).toContain(join(testDir, 'folder1'));
      expect(result.data.items).toContain(join(testDir, 'folder2'));
      expect(result.data.items).not.toContain(join(testDir, 'file1.txt'));
      expect(result.data.items).not.toContain(join(testDir, 'file2.txt'));
    });

    it('should prioritize onlyFiles when both onlyFiles and onlyFolders are true', async () => {
      const request: ListFilesRequestBody = {
        path: testDir,
        onlyFiles: true,
        onlyFolders: true,
      };

      const result = await processListFiles(request);

      expect(result.error).toBeUndefined();
      expect(result.data.items.length).toBe(2);
      expect(result.data.items).toContain(join(testDir, 'file1.txt'));
      expect(result.data.items).toContain(join(testDir, 'file2.txt'));
      expect(result.data.items).not.toContain(join(testDir, 'folder1'));
      expect(result.data.items).not.toContain(join(testDir, 'folder2'));
    });
  });

  describe('hidden files', () => {
    beforeEach(async () => {
      // Create regular and hidden files
      await writeFile(join(testDir, 'visible.txt'), 'visible', 'utf-8');
      await writeFile(join(testDir, '.hidden'), 'hidden', 'utf-8');
      await writeFile(join(testDir, '.hidden.txt'), 'hidden txt', 'utf-8');
      await mkdir(join(testDir, '.hiddenDir'), { recursive: true });
      await mkdir(join(testDir, 'visibleDir'), { recursive: true });
    });

    it('should exclude hidden files by default', async () => {
      const request: ListFilesRequestBody = {
        path: testDir,
      };

      const result = await processListFiles(request);

      expect(result.error).toBeUndefined();
      expect(result.data.items).toContain(join(testDir, 'visible.txt'));
      expect(result.data.items).toContain(join(testDir, 'visibleDir'));
      expect(result.data.items).not.toContain(join(testDir, '.hidden'));
      expect(result.data.items).not.toContain(join(testDir, '.hidden.txt'));
      expect(result.data.items).not.toContain(join(testDir, '.hiddenDir'));
    });

    it('should include hidden files when includeHiddenFiles is true', async () => {
      const request: ListFilesRequestBody = {
        path: testDir,
        includeHiddenFiles: true,
      };

      const result = await processListFiles(request);

      expect(result.error).toBeUndefined();
      expect(result.data.items.length).toBeGreaterThanOrEqual(5);
      expect(result.data.items).toContain(join(testDir, 'visible.txt'));
      expect(result.data.items).toContain(join(testDir, '.hidden'));
      expect(result.data.items).toContain(join(testDir, '.hidden.txt'));
      expect(result.data.items).toContain(join(testDir, '.hiddenDir'));
      expect(result.data.items).toContain(join(testDir, 'visibleDir'));
    });

    it('should filter Windows system files (Thumbs.db, desktop.ini) by default', async () => {
      // Create Windows system files
      await writeFile(join(testDir, 'Thumbs.db'), 'thumbs', 'utf-8');
      await writeFile(join(testDir, 'desktop.ini'), 'desktop', 'utf-8');
      await writeFile(join(testDir, 'normal.txt'), 'normal', 'utf-8');

      const request: ListFilesRequestBody = {
        path: testDir,
      };

      const result = await processListFiles(request);

      expect(result.error).toBeUndefined();
      expect(result.data.items).toContain(join(testDir, 'normal.txt'));
      expect(result.data.items).not.toContain(join(testDir, 'Thumbs.db'));
      expect(result.data.items).not.toContain(join(testDir, 'desktop.ini'));
    });

    it('should include Windows system files when includeHiddenFiles is true', async () => {
      // Create Windows system files
      await writeFile(join(testDir, 'Thumbs.db'), 'thumbs', 'utf-8');
      await writeFile(join(testDir, 'desktop.ini'), 'desktop', 'utf-8');
      await writeFile(join(testDir, 'normal.txt'), 'normal', 'utf-8');

      const request: ListFilesRequestBody = {
        path: testDir,
        includeHiddenFiles: true,
      };

      const result = await processListFiles(request);

      expect(result.error).toBeUndefined();
      expect(result.data.items).toContain(join(testDir, 'normal.txt'));
      expect(result.data.items).toContain(join(testDir, 'Thumbs.db'));
      expect(result.data.items).toContain(join(testDir, 'desktop.ini'));
    });
  });

  describe('edge cases', () => {
    it('should return empty array for empty directory', async () => {
      const request: ListFilesRequestBody = {
        path: testDir,
      };

      const result = await processListFiles(request);

      expect(result.error).toBeUndefined();
      expect(result.data.items).toEqual([]);
    });

    it('should handle files with special characters in names', async () => {
      await writeFile(join(testDir, 'file with spaces.txt'), 'content', 'utf-8');
      await writeFile(join(testDir, 'file-with-dashes.txt'), 'content', 'utf-8');
      await writeFile(join(testDir, 'file_with_underscores.txt'), 'content', 'utf-8');

      const request: ListFilesRequestBody = {
        path: testDir,
        onlyFiles: true,
      };

      const result = await processListFiles(request);

      expect(result.error).toBeUndefined();
      expect(result.data.items.length).toBe(3);
      expect(result.data.items).toContain(join(testDir, 'file with spaces.txt'));
      expect(result.data.items).toContain(join(testDir, 'file-with-dashes.txt'));
      expect(result.data.items).toContain(join(testDir, 'file_with_underscores.txt'));
    });

    it('should skip items that cannot be stat\'d (permissions, etc.)', async () => {
      // Create a normal file that we can access
      await writeFile(join(testDir, 'accessible.txt'), 'content', 'utf-8');

      const request: ListFilesRequestBody = {
        path: testDir,
      };

      const result = await processListFiles(request);

      // Should at least return the accessible file
      expect(result.error).toBeUndefined();
      expect(result.data.items).toContain(join(testDir, 'accessible.txt'));
      // Note: We can't easily test permission errors in a cross-platform way,
      // but the code should handle them gracefully
    });

    it('should handle nested directory structure', async () => {
      const nestedDir = join(testDir, 'nested');
      await mkdir(nestedDir, { recursive: true });
      await writeFile(join(nestedDir, 'nested-file.txt'), 'content', 'utf-8');

      const request: ListFilesRequestBody = {
        path: testDir,
      };

      const result = await processListFiles(request);

      expect(result.error).toBeUndefined();
      expect(result.data.items).toContain(nestedDir);
      expect(result.data.items).not.toContain(join(nestedDir, 'nested-file.txt')); // Only direct children
    });
  });

  describe('recursive listing', () => {
    beforeEach(async () => {
      // Create a nested directory structure
      // testDir/
      //   file1.txt
      //   folder1/
      //     file2.txt
      //     subfolder1/
      //       file3.txt
      //   folder2/
      //     file4.txt
      await writeFile(join(testDir, 'file1.txt'), 'content1', 'utf-8');
      const folder1 = join(testDir, 'folder1');
      await mkdir(folder1, { recursive: true });
      await writeFile(join(folder1, 'file2.txt'), 'content2', 'utf-8');
      const subfolder1 = join(folder1, 'subfolder1');
      await mkdir(subfolder1, { recursive: true });
      await writeFile(join(subfolder1, 'file3.txt'), 'content3', 'utf-8');
      const folder2 = join(testDir, 'folder2');
      await mkdir(folder2, { recursive: true });
      await writeFile(join(folder2, 'file4.txt'), 'content4', 'utf-8');
    });

    it('should list only immediate children when recursively is false (default)', async () => {
      const request: ListFilesRequestBody = {
        path: testDir,
        recursively: false,
      };

      const result = await processListFiles(request);

      expect(result.error).toBeUndefined();
      expect(result.data.items.length).toBe(3); // file1.txt, folder1, folder2
      expect(result.data.items).toContain(join(testDir, 'file1.txt'));
      expect(result.data.items).toContain(join(testDir, 'folder1'));
      expect(result.data.items).toContain(join(testDir, 'folder2'));
      // Should not include nested files
      expect(result.data.items).not.toContain(join(testDir, 'folder1', 'file2.txt'));
      expect(result.data.items).not.toContain(join(testDir, 'folder1', 'subfolder1', 'file3.txt'));
      expect(result.data.items).not.toContain(join(testDir, 'folder2', 'file4.txt'));
    });

    it('should list all files and folders recursively when recursively is true', async () => {
      const request: ListFilesRequestBody = {
        path: testDir,
        recursively: true,
      };

      const result = await processListFiles(request);

      expect(result.error).toBeUndefined();
      expect(result.data.items.length).toBe(7); // file1.txt, folder1, folder1/file2.txt, folder1/subfolder1, folder1/subfolder1/file3.txt, folder2, folder2/file4.txt
      expect(result.data.items).toContain(join(testDir, 'file1.txt'));
      expect(result.data.items).toContain(join(testDir, 'folder1'));
      expect(result.data.items).toContain(join(testDir, 'folder1', 'file2.txt'));
      expect(result.data.items).toContain(join(testDir, 'folder1', 'subfolder1'));
      expect(result.data.items).toContain(join(testDir, 'folder1', 'subfolder1', 'file3.txt'));
      expect(result.data.items).toContain(join(testDir, 'folder2'));
      expect(result.data.items).toContain(join(testDir, 'folder2', 'file4.txt'));
    });

    it('should recursively list only files when onlyFiles is true', async () => {
      const request: ListFilesRequestBody = {
        path: testDir,
        recursively: true,
        onlyFiles: true,
      };

      const result = await processListFiles(request);

      expect(result.error).toBeUndefined();
      expect(result.data.items.length).toBe(4); // All 4 files
      expect(result.data.items).toContain(join(testDir, 'file1.txt'));
      expect(result.data.items).toContain(join(testDir, 'folder1', 'file2.txt'));
      expect(result.data.items).toContain(join(testDir, 'folder1', 'subfolder1', 'file3.txt'));
      expect(result.data.items).toContain(join(testDir, 'folder2', 'file4.txt'));
      // Should not include folders
      expect(result.data.items).not.toContain(join(testDir, 'folder1'));
      expect(result.data.items).not.toContain(join(testDir, 'folder1', 'subfolder1'));
      expect(result.data.items).not.toContain(join(testDir, 'folder2'));
    });

    it('should recursively list only folders when onlyFolders is true', async () => {
      const request: ListFilesRequestBody = {
        path: testDir,
        recursively: true,
        onlyFolders: true,
      };

      const result = await processListFiles(request);

      expect(result.error).toBeUndefined();
      expect(result.data.items.length).toBe(3); // folder1, folder1/subfolder1, folder2
      expect(result.data.items).toContain(join(testDir, 'folder1'));
      expect(result.data.items).toContain(join(testDir, 'folder1', 'subfolder1'));
      expect(result.data.items).toContain(join(testDir, 'folder2'));
      // Should not include files
      expect(result.data.items).not.toContain(join(testDir, 'file1.txt'));
      expect(result.data.items).not.toContain(join(testDir, 'folder1', 'file2.txt'));
      expect(result.data.items).not.toContain(join(testDir, 'folder1', 'subfolder1', 'file3.txt'));
      expect(result.data.items).not.toContain(join(testDir, 'folder2', 'file4.txt'));
    });

    it('should skip hidden directories when recursively scanning and includeHiddenFiles is false', async () => {
      // Create hidden directory with files inside
      const hiddenDir = join(testDir, '.hiddenDir');
      await mkdir(hiddenDir, { recursive: true });
      await writeFile(join(hiddenDir, 'file-in-hidden.txt'), 'content', 'utf-8');
      await writeFile(join(testDir, 'visible-file.txt'), 'content', 'utf-8');

      const request: ListFilesRequestBody = {
        path: testDir,
        recursively: true,
        includeHiddenFiles: false,
      };

      const result = await processListFiles(request);

      expect(result.error).toBeUndefined();
      expect(result.data.items).toContain(join(testDir, 'visible-file.txt'));
      expect(result.data.items).not.toContain(hiddenDir);
      expect(result.data.items).not.toContain(join(hiddenDir, 'file-in-hidden.txt'));
    });

    it('should include hidden directories when recursively scanning and includeHiddenFiles is true', async () => {
      // Create hidden directory with files inside
      const hiddenDir = join(testDir, '.hiddenDir');
      await mkdir(hiddenDir, { recursive: true });
      await writeFile(join(hiddenDir, 'file-in-hidden.txt'), 'content', 'utf-8');
      await writeFile(join(testDir, 'visible-file.txt'), 'content', 'utf-8');

      const request: ListFilesRequestBody = {
        path: testDir,
        recursively: true,
        includeHiddenFiles: true,
      };

      const result = await processListFiles(request);

      expect(result.error).toBeUndefined();
      expect(result.data.items).toContain(join(testDir, 'visible-file.txt'));
      expect(result.data.items).toContain(hiddenDir);
      expect(result.data.items).toContain(join(hiddenDir, 'file-in-hidden.txt'));
    });

    it('should recursively scan directories even when they are filtered out by onlyFiles', async () => {
      const request: ListFilesRequestBody = {
        path: testDir,
        recursively: true,
        onlyFiles: true,
      };

      const result = await processListFiles(request);

      expect(result.error).toBeUndefined();
      // Should find all files in nested directories, even though folders are filtered out
      expect(result.data.items.length).toBe(4);
      expect(result.data.items).toContain(join(testDir, 'file1.txt'));
      expect(result.data.items).toContain(join(testDir, 'folder1', 'file2.txt'));
      expect(result.data.items).toContain(join(testDir, 'folder1', 'subfolder1', 'file3.txt'));
      expect(result.data.items).toContain(join(testDir, 'folder2', 'file4.txt'));
    });

    it('should handle deeply nested directory structures', async () => {
      // Create a deeply nested structure
      const level1 = join(testDir, 'level1');
      const level2 = join(level1, 'level2');
      const level3 = join(level2, 'level3');
      await mkdir(level3, { recursive: true });
      await writeFile(join(level3, 'deep-file.txt'), 'content', 'utf-8');

      const request: ListFilesRequestBody = {
        path: testDir,
        recursively: true,
        onlyFiles: true,
      };

      const result = await processListFiles(request);

      expect(result.error).toBeUndefined();
      expect(result.data.items).toContain(join(level3, 'deep-file.txt'));
    });

    it('should default to recursively false when not specified', async () => {
      const request: ListFilesRequestBody = {
        path: testDir,
        // recursively not specified
      };

      const result = await processListFiles(request);

      expect(result.error).toBeUndefined();
      // Should only list immediate children
      expect(result.data.items.length).toBe(3);
      expect(result.data.items).not.toContain(join(testDir, 'folder1', 'file2.txt'));
    });
  });

  describe('filter combinations', () => {
    beforeEach(async () => {
      await writeFile(join(testDir, 'file1.txt'), 'content', 'utf-8');
      await writeFile(join(testDir, '.hidden-file'), 'content', 'utf-8');
      await mkdir(join(testDir, 'folder1'), { recursive: true });
      await mkdir(join(testDir, '.hidden-folder'), { recursive: true });
    });

    it('should filter files only with hidden files excluded', async () => {
      const request: ListFilesRequestBody = {
        path: testDir,
        onlyFiles: true,
        includeHiddenFiles: false,
      };

      const result = await processListFiles(request);

      expect(result.error).toBeUndefined();
      expect(result.data.items.length).toBe(1);
      expect(result.data.items).toContain(join(testDir, 'file1.txt'));
      expect(result.data.items).not.toContain(join(testDir, '.hidden-file'));
    });

    it('should filter folders only with hidden folders excluded', async () => {
      const request: ListFilesRequestBody = {
        path: testDir,
        onlyFolders: true,
        includeHiddenFiles: false,
      };

      const result = await processListFiles(request);

      expect(result.error).toBeUndefined();
      expect(result.data.items.length).toBe(1);
      expect(result.data.items).toContain(join(testDir, 'folder1'));
      expect(result.data.items).not.toContain(join(testDir, '.hidden-folder'));
    });

    it('should filter files only with hidden files included', async () => {
      const request: ListFilesRequestBody = {
        path: testDir,
        onlyFiles: true,
        includeHiddenFiles: true,
      };

      const result = await processListFiles(request);

      expect(result.error).toBeUndefined();
      expect(result.data.items.length).toBe(2);
      expect(result.data.items).toContain(join(testDir, 'file1.txt'));
      expect(result.data.items).toContain(join(testDir, '.hidden-file'));
    });

    it('should filter folders only with hidden folders included', async () => {
      const request: ListFilesRequestBody = {
        path: testDir,
        onlyFolders: true,
        includeHiddenFiles: true,
      };

      const result = await processListFiles(request);

      expect(result.error).toBeUndefined();
      expect(result.data.items.length).toBe(2);
      expect(result.data.items).toContain(join(testDir, 'folder1'));
      expect(result.data.items).toContain(join(testDir, '.hidden-folder'));
    });

    it('should return both files and folders when onlyFolders is explicitly false', async () => {
      await writeFile(join(testDir, 'file2.txt'), 'content', 'utf-8');
      await mkdir(join(testDir, 'folder2'), { recursive: true });

      const request: ListFilesRequestBody = {
        path: testDir,
        onlyFolders: false,
        includeHiddenFiles: false,
      };

      const result = await processListFiles(request);

      expect(result.error).toBeUndefined();
      // Should include both files and folders (excluding hidden)
      expect(result.data.items.length).toBeGreaterThanOrEqual(3);
      expect(result.data.items).toContain(join(testDir, 'file1.txt'));
      expect(result.data.items).toContain(join(testDir, 'file2.txt'));
      expect(result.data.items).toContain(join(testDir, 'folder1'));
      expect(result.data.items).toContain(join(testDir, 'folder2'));
      expect(result.data.items).not.toContain(join(testDir, '.hidden-file'));
      expect(result.data.items).not.toContain(join(testDir, '.hidden-folder'));
    });
  });

  describe('POSIX-style Windows path conversion', () => {
    // Only run these tests on Windows
    const isWindows = process.platform === 'win32';

    (isWindows ? it : it.skip)('should convert POSIX-style Windows path /C/Users/... to C:\\Users\\...', async () => {
      // Create test files in a known location (using temp dir to avoid permission issues)
      await writeFile(join(testDir, 'test.txt'), 'content', 'utf-8');
      await mkdir(join(testDir, 'test-folder'), { recursive: true });

      // Get the Windows drive letter from the test directory
      const driveLetter = testDir.charAt(0).toUpperCase();
      const restOfPath = testDir.slice(2).replace(/\\/g, '/'); // Convert backslashes to forward slashes
      const posixPath = `/${driveLetter}${restOfPath}`;

      const request: ListFilesRequestBody = {
        path: posixPath,
      };

      const result = await processListFiles(request);

      expect(result.error).toBeUndefined();
      expect(result.data.items.length).toBeGreaterThanOrEqual(2);
      // Verify paths are in Windows format (backslashes)
      result.data.items.forEach(p => {
        expect(p).toContain('\\');
        expect(p).not.toMatch(/^\/[A-Za-z]:/); // Should not start with /C:
      });
      expect(result.data.items).toContain(join(testDir, 'test.txt'));
      expect(result.data.items).toContain(join(testDir, 'test-folder'));
    });

    (isWindows ? it : it.skip)('should convert POSIX-style Windows path /C:/Users/... to C:\\Users\\...', async () => {
      await writeFile(join(testDir, 'test2.txt'), 'content', 'utf-8');

      // Get the Windows drive letter from the test directory
      const driveLetter = testDir.charAt(0).toUpperCase();
      const restOfPath = testDir.slice(2).replace(/\\/g, '/');
      const posixPath = `/${driveLetter}:${restOfPath}`;

      const request: ListFilesRequestBody = {
        path: posixPath,
      };

      const result = await processListFiles(request);

      expect(result.error).toBeUndefined();
      expect(result.data.items.length).toBeGreaterThanOrEqual(1);
      // Verify paths are in Windows format
      result.data.items.forEach(p => {
        expect(p).toContain('\\');
        expect(p).toMatch(/^[A-Za-z]:\\/); // Should start with C:\
      });
      expect(result.data.items).toContain(join(testDir, 'test2.txt'));
    });

    (isWindows ? it : it.skip)('should return paths in Windows format on Windows', async () => {
      await writeFile(join(testDir, 'windows-format-test.txt'), 'content', 'utf-8');

      const request: ListFilesRequestBody = {
        path: testDir,
        onlyFiles: true,
      };

      const result = await processListFiles(request);

      expect(result.error).toBeUndefined();
      expect(result.data.items.length).toBeGreaterThanOrEqual(1);
      // All paths should be in Windows format (backslashes, drive letter format)
      result.data.items.forEach(p => {
        expect(p).toMatch(/^[A-Za-z]:\\/); // Should start with C:\ or similar
        expect(p).toContain('\\'); // Should use backslashes
        expect(p).not.toContain('/'); // Should not contain forward slashes (except maybe in filename)
      });
    });
  });
});

