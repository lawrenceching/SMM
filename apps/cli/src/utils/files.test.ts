import { describe, it, expect, vi, beforeEach } from 'vitest';
import { moveFileToTrashOrDelete } from './files';

vi.mock('./os', () => ({
  isDesktopEnv: vi.fn(),
}));

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual('node:fs/promises');
  return {
    ...actual,
    access: vi.fn(),
    stat: vi.fn(),
    unlink: vi.fn(),
  };
});

vi.mock('shelljs', () => ({
  exec: vi.fn(),
}));

describe('moveFileToTrashOrDelete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Input validation', () => {
    it('should throw error when file does not exist', async () => {
      const { access, stat } = await import('node:fs/promises');
      vi.mocked(access).mockRejectedValue({ code: 'ENOENT' });
      vi.mocked(stat).mockResolvedValue({ isFile: () => true });

      await expect(moveFileToTrashOrDelete('/nonexistent/file.txt'))
        .rejects
        .toThrow('File not found: /nonexistent/file.txt');
    });

    it('should throw error when file is not accessible due to permissions', async () => {
      const { access } = await import('node:fs/promises');
      vi.mocked(access).mockRejectedValue({ code: 'EACCES' });

      await expect(moveFileToTrashOrDelete('/protected/file.txt'))
        .rejects
        .toThrow('Permission denied: Cannot access file /protected/file.txt');
    });

    it('should throw error when path is a directory', async () => {
      const { access, stat } = await import('node:fs/promises');
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(stat).mockResolvedValue({ isFile: () => false, isDirectory: () => true });

      await expect(moveFileToTrashOrDelete('/some/directory'))
        .rejects
        .toThrow('Path is not a file: /some/directory');
    });
  });

  describe('Server environment behavior', () => {
    beforeEach(async () => {
      const osModule = await import('./os');
      vi.mocked(osModule.isDesktopEnv).mockReturnValue(false);
    });

    it('should permanently delete file on server environment', async () => {
      const { access, stat, unlink } = await import('node:fs/promises');
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(stat).mockResolvedValue({ isFile: () => true });
      vi.mocked(unlink).mockResolvedValue(undefined);

      await moveFileToTrashOrDelete('/path/to/file.txt');

      expect(vi.mocked(unlink)).toHaveBeenCalledWith('/path/to/file.txt');
    });

    it('should throw error when permanent delete fails with ENOENT', async () => {
      const { access, stat, unlink } = await import('node:fs/promises');
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(stat).mockResolvedValue({ isFile: () => true });
      vi.mocked(unlink).mockRejectedValue({ code: 'ENOENT' });

      await expect(moveFileToTrashOrDelete('/path/to/file.txt'))
        .rejects
        .toThrow('File not found: /path/to/file.txt');
    });

    it('should throw error when permanent delete fails with permission error', async () => {
      const { access, stat, unlink } = await import('node:fs/promises');
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(stat).mockResolvedValue({ isFile: () => true });
      vi.mocked(unlink).mockRejectedValue({ code: 'EACCES' });

      await expect(moveFileToTrashOrDelete('/path/to/file.txt'))
        .rejects
        .toThrow('Permission denied: Cannot delete file /path/to/file.txt');
    });

    it('should throw error when permanent delete fails with EPERM', async () => {
      const { access, stat, unlink } = await import('node:fs/promises');
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(stat).mockResolvedValue({ isFile: () => true });
      vi.mocked(unlink).mockRejectedValue({ code: 'EPERM' });

      await expect(moveFileToTrashOrDelete('/path/to/file.txt'))
        .rejects
        .toThrow('Permission denied: Cannot delete file /path/to/file.txt');
    });
  });
});
