import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test';
import { validateMetadataExists } from './matchEpisodesInBatch';
import { mkdir, writeFile, rm, readFile } from 'fs/promises';
import { join } from 'path';
import { getAppDataDir } from 'tasks/HelloTask';

// Use the actual media metadata directory
const mediaMetadataDir = join(getAppDataDir(), 'metadata');

// Track created files for cleanup
const createdFiles: string[] = [];

async function cleanupTestFile(filePath: string) {
  try {
    await rm(filePath, { force: true });
    const index = createdFiles.indexOf(filePath);
    if (index > -1) createdFiles.splice(index, 1);
  } catch {
    // Ignore cleanup errors
  }
}

afterAll(async () => {
  // Cleanup all created files
  for (const filePath of createdFiles) {
    try {
      await rm(filePath, { force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
});

describe('validateMetadataExists', () => {
  describe('POSIX paths', () => {
    it('should return valid when metadata file exists for POSIX folder path', async () => {
      const testFolder = '/media/videos/anime';
      const metadataFile = join(mediaMetadataDir, testFolder.replace(/[\/\\:?*|<>"]/g, '_') + '.json');
      await mkdir(mediaMetadataDir, { recursive: true });
      await writeFile(metadataFile, '{}');
      createdFiles.push(metadataFile);

      const result = await validateMetadataExists(testFolder);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return error when metadata file does not exist for POSIX folder path', async () => {
      const testFolder = '/media/videos/unknown';

      const result = await validateMetadataExists(testFolder);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('/media/videos/unknown');
      expect(result.error).toContain('not opened in SMM');
    });
  });

  describe('Windows paths', () => {
    it('should return valid when metadata file exists for Windows folder path', async () => {
      const testFolder = 'F:\\Media\\Anime';
      const normalizedFolder = '/F/Media/Anime';
      const metadataFile = join(mediaMetadataDir, normalizedFolder.replace(/[\/\\:?*|<>"]/g, '_') + '.json');
      await mkdir(mediaMetadataDir, { recursive: true });
      await writeFile(metadataFile, '{}');
      createdFiles.push(metadataFile);

      const result = await validateMetadataExists(testFolder);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return error when metadata file does not exist for Windows folder path', async () => {
      const testFolder = 'D:\\Media\\Unknown';

      const result = await validateMetadataExists(testFolder);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('/D/Media/Unknown');
      expect(result.error).toContain('not opened in SMM');
    });
  });

  describe('Paths with special characters', () => {
    it('should handle folder path with colons', async () => {
      const testFolder = '/media/videos:folder/test';
      const metadataFile = join(mediaMetadataDir, testFolder.replace(/[\/\\:?*|<>"]/g, '_') + '.json');
      await mkdir(mediaMetadataDir, { recursive: true });
      await writeFile(metadataFile, '{}');
      createdFiles.push(metadataFile);

      const result = await validateMetadataExists(testFolder);

      expect(result.isValid).toBe(true);
    });

    it('should handle folder path with question marks', async () => {
      const testFolder = '/media/what?/folder';

      const result = await validateMetadataExists(testFolder);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('not opened in SMM');
    });
  });

  describe('Network paths (UNC)', () => {
    it('should return valid when metadata file exists for UNC network path', async () => {
      const testFolder = '\\\\server\\share\\media';
      const normalizedFolder = '/server/share/media';
      const metadataFile = join(mediaMetadataDir, normalizedFolder.replace(/[\/\\:?*|<>"]/g, '_') + '.json');
      await mkdir(mediaMetadataDir, { recursive: true });
      await writeFile(metadataFile, '{}');
      createdFiles.push(metadataFile);

      const result = await validateMetadataExists(testFolder);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return error when metadata file does not exist for UNC network path', async () => {
      const testFolder = '\\\\server\\share\\unknown';

      const result = await validateMetadataExists(testFolder);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('not opened in SMM');
    });
  });

  describe('Edge cases', () => {
    it('should return error for non-existent folder path', async () => {
      const testFolder = '/nonexistent/path/folder12345';

      const result = await validateMetadataExists(testFolder);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('not opened in SMM');
    });

    it('should handle path with trailing slash', async () => {
      // Path.posix('/media/videos/') returns '/media/videos'
      // After sanitization: _media_videos.json (single underscore)
      const testFolder = '/media/videos/';
      const expectedSanitized = '_media_videos';
      const metadataFile = join(mediaMetadataDir, `${expectedSanitized}.json`);
      await mkdir(mediaMetadataDir, { recursive: true });
      await writeFile(metadataFile, '{}');
      createdFiles.push(metadataFile);

      const result = await validateMetadataExists(testFolder);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle path with multiple trailing slashes', async () => {
      // Path.posix('/media/videos///') returns '/media/videos'
      // After sanitization: _media_videos.json (single underscore)
      const testFolder = '/media/videos///';
      const expectedSanitized = '_media_videos';
      const metadataFile = join(mediaMetadataDir, `${expectedSanitized}.json`);
      await mkdir(mediaMetadataDir, { recursive: true });
      await writeFile(metadataFile, '{}');
      createdFiles.push(metadataFile);

      const result = await validateMetadataExists(testFolder);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
});
