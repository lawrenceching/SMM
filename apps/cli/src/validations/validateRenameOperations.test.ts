import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateRenameOperations } from '../tools/renameFilesInBatch';
import { getMediaFolder } from '../utils/getMediaFolder';

// Mock transitive dependencies that require runtime-only modules
vi.mock('tasks/HelloTask', () => ({
  getAppDataDir: () => '/tmp/smm-test',
}));

vi.mock('../events/askForRenameFilesConfirmation', () => ({
  askForRenameFilesConfirmation: vi.fn(async () => true),
}));

vi.mock('../utils/renameFileUtils', () => ({
  executeBatchRenameOperations: vi.fn(async () => ({ success: true, successfulRenames: [] })),
  updateMediaMetadataAndBroadcast: vi.fn(async () => ({ success: true })),
}));

// Mock filesystem checks so tests run without real files
vi.mock('../validations/validateSourceFileExist', () => ({
  validateSourceFileExist: vi.fn(async (_files: Array<{ from: string; to: string }>) => ({
    isValid: true,
    missingFiles: [],
  })),
}));

vi.mock('../validations/validateDestFileNotExist', () => ({
  validateDestFileNotExist: vi.fn(async (_files: Array<{ from: string; to: string }>) => ({
    isValid: true,
    existingFiles: [],
  })),
}));

import { validateSourceFileExist } from '../validations/validateSourceFileExist';
import { validateDestFileNotExist } from '../validations/validateDestFileNotExist';

const mockValidateSourceFileExist = vi.mocked(validateSourceFileExist);
const mockValidateDestFileNotExist = vi.mocked(validateDestFileNotExist);

describe('validateRenameOperations', () => {
  const mediaFolder = '/home/user/media';

  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateSourceFileExist.mockResolvedValue({ isValid: true, missingFiles: [] });
    mockValidateDestFileNotExist.mockResolvedValue({ isValid: true, existingFiles: [] });
  });

  it('should return isValid true and empty arrays for empty input', async () => {
    const result = await validateRenameOperations([], mediaFolder);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.validatedRenames).toHaveLength(0);
  });

  it('should return isValid true for valid rename operations', async () => {
    const files = [
      { from: '/home/user/media/ep1.mp4', to: '/home/user/media/S01E01.mp4' },
    ];
    const result = await validateRenameOperations(files, mediaFolder);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.validatedRenames).toHaveLength(1);
    expect(result.validatedRenames[0]).toEqual({
      from: '/home/user/media/ep1.mp4',
      to: '/home/user/media/S01E01.mp4',
    });
  });

  it('should normalize Windows paths to POSIX in validatedRenames', async () => {
    const files = [
      { from: 'C:\\Users\\media\\ep1.mp4', to: 'C:\\Users\\media\\S01E01.mp4' },
    ];
    const result = await validateRenameOperations(files, '/C/Users/media');
    expect(result.isValid).toBe(true);
    // normalized to posix
    expect(result.validatedRenames[0]!.from).toMatch(/\//);
  });

  it('should return error when source file does not exist', async () => {
    mockValidateSourceFileExist.mockResolvedValue({
      isValid: false,
      missingFiles: ['/home/user/media/missing.mp4'],
    });
    const files = [
      { from: '/home/user/media/missing.mp4', to: '/home/user/media/S01E01.mp4' },
    ];
    const result = await validateRenameOperations(files, mediaFolder);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('does not exist'))).toBe(true);
    expect(result.validatedRenames).toHaveLength(0);
  });

  it('should return error when destination file already exists', async () => {
    mockValidateDestFileNotExist.mockResolvedValue({
      isValid: false,
      existingFiles: ['/home/user/media/S01E01.mp4'],
    });
    const files = [
      { from: '/home/user/media/ep1.mp4', to: '/home/user/media/S01E01.mp4' },
    ];
    const result = await validateRenameOperations(files, mediaFolder);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('already exists'))).toBe(true);
    expect(result.validatedRenames).toHaveLength(0);
  });

  it('should return error for duplicate source files', async () => {
    const files = [
      { from: '/home/user/media/ep1.mp4', to: '/home/user/media/S01E01.mp4' },
      { from: '/home/user/media/ep1.mp4', to: '/home/user/media/S01E02.mp4' },
    ];
    const result = await validateRenameOperations(files, mediaFolder);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('appears multiple times'))).toBe(true);
  });

  it('should return error for duplicate destination files', async () => {
    const files = [
      { from: '/home/user/media/ep1.mp4', to: '/home/user/media/S01E01.mp4' },
      { from: '/home/user/media/ep2.mp4', to: '/home/user/media/S01E01.mp4' },
    ];
    const result = await validateRenameOperations(files, mediaFolder);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('appears multiple times'))).toBe(true);
  });

  it('should exclude identical source/dest from validatedRenames (treated as chaining conflict)', async () => {
    // When from === to, the chaining conflict check fires (to is in sourcePaths),
    // producing an error. The task is excluded from validatedRenames in either case.
    const files = [
      { from: '/home/user/media/ep1.mp4', to: '/home/user/media/ep1.mp4' },
    ];
    const result = await validateRenameOperations(files, mediaFolder);
    expect(result.validatedRenames).toHaveLength(0);
  });

  it('should return error for paths outside media folder', async () => {
    const files = [
      { from: '/other/ep1.mp4', to: '/home/user/media/S01E01.mp4' },
    ];
    const result = await validateRenameOperations(files, mediaFolder);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('outside the media folder'))).toBe(true);
  });

  it('should return error for chaining conflicts', async () => {
    const files = [
      { from: '/home/user/media/a.mp4', to: '/home/user/media/b.mp4' },
      { from: '/home/user/media/b.mp4', to: '/home/user/media/c.mp4' },
    ];
    const result = await validateRenameOperations(files, mediaFolder);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('cannot chain renames'))).toBe(true);
  });

  it('should handle multiple valid operations in a batch', async () => {
    const files = [
      { from: '/home/user/media/ep1.mp4', to: '/home/user/media/S01E01.mp4' },
      { from: '/home/user/media/ep2.mp4', to: '/home/user/media/S01E02.mp4' },
      { from: '/home/user/media/ep3.mp4', to: '/home/user/media/S01E03.mp4' },
    ];
    const result = await validateRenameOperations(files, mediaFolder);
    expect(result.isValid).toBe(true);
    expect(result.validatedRenames).toHaveLength(3);
  });

  it('should skip undefined/null operations in the batch', async () => {
    const files = [
      { from: '/home/user/media/ep1.mp4', to: '/home/user/media/S01E01.mp4' },
      undefined as any,
    ];
    const result = await validateRenameOperations(files, mediaFolder);
    expect(result.validatedRenames).toHaveLength(1);
  });
});

describe('getMediaFolder', () => {
  describe('Exact match scenarios', () => {
    it('should return folder when filePath exactly matches a folder', () => {
      const result = getMediaFolder('/home/user/media', ['/home/user/media', '/home/user/documents']);
      expect(result).toBe('/home/user/media');
    });

    it('should return folder when filePath exactly matches a Windows path', () => {
      const result = getMediaFolder('C:\\Media\\Movies', ['C:\\Media\\Movies', 'C:\\Media\\TV']);
      expect(result).toBe('C:\\Media\\Movies');
    });
  });

  describe('File inside folder scenarios', () => {
    it('should return folder when file is inside a POSIX folder', () => {
      const result = getMediaFolder('/home/user/media/movie.mp4', ['/home/user/media', '/home/user/documents']);
      expect(result).toBe('/home/user/media');
    });

    it('should return folder when file is deeply nested', () => {
      const result = getMediaFolder('/home/user/media/tv/show/season1/ep1.mp4', ['/home/user/media']);
      expect(result).toBe('/home/user/media');
    });

    it('should return folder when file is inside a Windows folder', () => {
      const result = getMediaFolder('C:\\Media\\Movies\\movie.mp4', ['C:\\Media\\Movies', 'C:\\Media\\TV']);
      expect(result).toBe('C:\\Media\\Movies');
    });
  });

  describe('No match scenarios', () => {
    it('should return null when file is not in any folder', () => {
      const result = getMediaFolder('/home/user/other/file.txt', ['/home/user/media', '/home/user/documents']);
      expect(result).toBeNull();
    });

    it('should return null when folderPaths is empty', () => {
      const result = getMediaFolder('/home/user/media/file.mp4', []);
      expect(result).toBeNull();
    });
  });

  describe('Trailing slash scenarios', () => {
    it('should handle folder path with trailing slash', () => {
      const result = getMediaFolder('/home/user/media/movie.mp4', ['/home/user/media/', '/home/user/documents']);
      expect(result).toBe('/home/user/media/');
    });

    it('should handle folder path without trailing slash', () => {
      const result = getMediaFolder('/home/user/media/movie.mp4', ['/home/user/media', '/home/user/documents']);
      expect(result).toBe('/home/user/media');
    });
  });

  describe('First-match behavior', () => {
    it('should return first matching folder', () => {
      const result = getMediaFolder('/home/user/media/movie.mp4', ['/home/user', '/home/user/media']);
      expect(result).toBe('/home/user');
    });
  });
});
