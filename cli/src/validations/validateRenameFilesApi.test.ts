import { describe, it, expect, beforeEach, mock } from 'bun:test';
import type { UserConfig } from '@core/types';

let mockFolders: string[] = [];

mock.module('@/utils/config', () => ({
  getUserConfig: async (): Promise<UserConfig> =>
    ({ folders: mockFolders, applicationLanguage: 'en', tmdb: {}, selectedRenameRule: 'plex' }) as UserConfig,
}));

const { validateRenameFilesRequest } = await import('./validateRenameFilesApi');

describe('validateRenameFilesRequest', () => {
  beforeEach(() => {
    mockFolders = ['/media/test'];
  });

  it('returns all valid when from is under a media folder and to is in same directory', async () => {
    const files = [
      { from: '/media/test/file1.txt', to: '/media/test/renamed1.txt' },
      { from: '/media/test/sub/file2.txt', to: '/media/test/sub/renamed2.txt' },
    ];
    const result = await validateRenameFilesRequest(files);
    expect(result.valid).toHaveLength(2);
    expect(result.valid).toEqual(files);
    expect(result.failed).toHaveLength(0);
  });

  it('returns empty valid and failed for empty files array', async () => {
    const result = await validateRenameFilesRequest([]);
    expect(result.valid).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
  });

  it('fails when from is not under any opened media folder', async () => {
    const files = [{ from: '/other/folder/file.txt', to: '/other/folder/renamed.txt' }];
    const result = await validateRenameFilesRequest(files);
    expect(result.valid).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]).toEqual({
      path: '/other/folder/file.txt',
      error: 'Source path is not under any opened media folder',
    });
  });

  it('fails when to is in a different directory than from', async () => {
    const files = [{ from: '/media/test/file.txt', to: '/media/test/other/renamed.txt' }];
    const result = await validateRenameFilesRequest(files);
    expect(result.valid).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]).toEqual({
      path: '/media/test/other/renamed.txt',
      error: 'Destination must be in the same folder as the source',
    });
  });

  it('fails when from is empty', async () => {
    const files = [{ from: '', to: '/media/test/renamed.txt' }];
    const result = await validateRenameFilesRequest(files);
    expect(result.valid).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.error).toBe('from and to are required');
    expect(result.failed[0]?.path).toBe('/media/test/renamed.txt'); // from || to || ''
  });

  it('fails when to is empty', async () => {
    const files = [{ from: '/media/test/file.txt', to: '' }];
    const result = await validateRenameFilesRequest(files);
    expect(result.valid).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.error).toBe('from and to are required');
    expect(result.failed[0]?.path).toBe('/media/test/file.txt'); // from || to || ''
  });

  it('fails when from is only whitespace', async () => {
    const files = [{ from: '   ', to: '/media/test/renamed.txt' }];
    const result = await validateRenameFilesRequest(files);
    expect(result.valid).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.error).toBe('from and to are required');
  });

  it('splits valid and failed when some entries pass and some fail', async () => {
    const files = [
      { from: '/media/test/a.txt', to: '/media/test/a2.txt' },
      { from: '/outside/file.txt', to: '/outside/renamed.txt' },
      { from: '/media/test/b.txt', to: '/media/test/sub/b2.txt' },
    ];
    const result = await validateRenameFilesRequest(files);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]).toEqual({ from: '/media/test/a.txt', to: '/media/test/a2.txt' });
    expect(result.failed).toHaveLength(2);
    expect(result.failed[0]?.path).toBe('/outside/file.txt');
    expect(result.failed[0]?.error).toBe('Source path is not under any opened media folder');
    expect(result.failed[1]?.path).toBe('/media/test/sub/b2.txt');
    expect(result.failed[1]?.error).toBe('Destination must be in the same folder as the source');
  });

  it('uses multiple folders when from is under second folder', async () => {
    mockFolders = ['/media/a', '/media/b'];
    const files = [{ from: '/media/b/doc.txt', to: '/media/b/doc2.txt' }];
    const result = await validateRenameFilesRequest(files);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]).toEqual({ from: '/media/b/doc.txt', to: '/media/b/doc2.txt' });
    expect(result.failed).toHaveLength(0);
  });

  it('treats userConfig.folders as empty when not set', async () => {
    mockFolders = [];
    const files = [{ from: '/media/test/file.txt', to: '/media/test/renamed.txt' }];
    const result = await validateRenameFilesRequest(files);
    expect(result.valid).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.error).toBe('Source path is not under any opened media folder');
  });

  it('accepts path equal to folder (edge case: file at folder root)', async () => {
    mockFolders = ['/media/test'];
    const files = [{ from: '/media/test/file.txt', to: '/media/test/other.txt' }];
    const result = await validateRenameFilesRequest(files);
    expect(result.valid).toHaveLength(1);
    expect(result.failed).toHaveLength(0);
  });
});
