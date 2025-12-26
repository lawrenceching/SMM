import { describe, it, expect } from 'bun:test';
import { validatePathWithinMediaFolder } from './validatePathWithinMediaFolder';

describe('validatePathWithinMediaFolder', () => {
  const mediaFolderPath = '/media/test';

  it('returns valid for empty array', () => {
    const result = validatePathWithinMediaFolder(mediaFolderPath, []);
    expect(result.isValid).toBe(true);
    expect(result.invalidPaths).toHaveLength(0);
  });

  it('returns valid when all paths are within media folder', () => {
    const tasks = [
      { from: '/media/test/file1.txt', to: '/media/test/renamed1.txt' },
      { from: '/media/test/subdir/file2.txt', to: '/media/test/subdir/renamed2.txt' },
    ];
    const result = validatePathWithinMediaFolder(mediaFolderPath, tasks);
    expect(result.isValid).toBe(true);
    expect(result.invalidPaths).toHaveLength(0);
  });

  it('detects source path outside media folder', () => {
    const tasks = [
      { from: '/other/folder/file.txt', to: '/media/test/renamed.txt' },
    ];
    const result = validatePathWithinMediaFolder(mediaFolderPath, tasks);
    expect(result.isValid).toBe(false);
    expect(result.invalidPaths).toHaveLength(1);
    expect(result.invalidPaths[0]).toEqual({ path: '/other/folder/file.txt', type: 'source' });
  });

  it('detects destination path outside media folder', () => {
    const tasks = [
      { from: '/media/test/file.txt', to: '/other/folder/renamed.txt' },
    ];
    const result = validatePathWithinMediaFolder(mediaFolderPath, tasks);
    expect(result.isValid).toBe(false);
    expect(result.invalidPaths).toHaveLength(1);
    expect(result.invalidPaths[0]).toEqual({ path: '/other/folder/renamed.txt', type: 'destination' });
  });

  it('detects both source and destination outside media folder', () => {
    const tasks = [
      { from: '/other/file.txt', to: '/another/renamed.txt' },
    ];
    const result = validatePathWithinMediaFolder(mediaFolderPath, tasks);
    expect(result.isValid).toBe(false);
    expect(result.invalidPaths).toHaveLength(2);
  });

  it('detects multiple tasks with invalid paths', () => {
    const tasks = [
      { from: '/media/test/file1.txt', to: '/media/test/renamed1.txt' },
      { from: '/other/file.txt', to: '/media/test/renamed2.txt' },
      { from: '/media/test/file3.txt', to: '/outside/renamed3.txt' },
    ];
    const result = validatePathWithinMediaFolder(mediaFolderPath, tasks);
    expect(result.isValid).toBe(false);
    expect(result.invalidPaths).toHaveLength(2);
    expect(result.invalidPaths.map(p => p.type)).toContain('source');
    expect(result.invalidPaths.map(p => p.type)).toContain('destination');
  });

  it('handles tasks with undefined entries', () => {
    const tasks = [
      { from: '/media/test/file.txt', to: '/outside/renamed.txt' },
      undefined as any,
    ];
    const result = validatePathWithinMediaFolder(mediaFolderPath, tasks);
    expect(result.isValid).toBe(false);
    expect(result.invalidPaths).toHaveLength(1);
  });

  it('handles Windows paths with slash format (drive letter prefix)', () => {
    const tasks = [
      { from: '/C/media/test/file.txt', to: '/C/media/test/renamed.txt' },
      { from: '/D/other/file.txt', to: '/C/media/test/renamed2.txt' },
    ];
    const result = validatePathWithinMediaFolder('/C/media/test', tasks);
    expect(result.isValid).toBe(false);
    expect(result.invalidPaths).toHaveLength(1);
    expect(result.invalidPaths[0].type).toBe('source');
  });

  it('handles paths with special characters', () => {
    const tasks = [
      { from: '/media/test/file (1).txt', to: '/media/test/renamed.txt' },
      { from: '/media/test/file[1].txt', to: '/other/renamed.txt' },
    ];
    const result = validatePathWithinMediaFolder(mediaFolderPath, tasks);
    expect(result.isValid).toBe(false);
    expect(result.invalidPaths).toHaveLength(1);
    expect(result.invalidPaths[0].type).toBe('destination');
  });

  it('handles nested subdirectories', () => {
    const tasks = [
      { from: '/media/test/a/b/c/file.txt', to: '/media/test/a/b/c/renamed.txt' },
      { from: '/media/test/a/file.txt', to: '/outside/a/renamed.txt' },
    ];
    const result = validatePathWithinMediaFolder(mediaFolderPath, tasks);
    expect(result.isValid).toBe(false);
    expect(result.invalidPaths).toHaveLength(1);
    expect(result.invalidPaths[0].type).toBe('destination');
  });

  it('recognizes parent folder paths as outside', () => {
    const tasks = [
      { from: '/media/test/file.txt', to: '/media/renamed.txt' },
    ];
    const result = validatePathWithinMediaFolder(mediaFolderPath, tasks);
    expect(result.isValid).toBe(false);
    expect(result.invalidPaths).toHaveLength(1);
    expect(result.invalidPaths[0].type).toBe('destination');
  });
});
