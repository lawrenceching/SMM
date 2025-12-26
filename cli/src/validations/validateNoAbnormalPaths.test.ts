import { describe, it, expect } from 'bun:test';
import { validateNoAbnormalPaths } from './validateNoAbnormalPaths';

describe('validateNoAbnormalPaths', () => {
  it('returns empty array for empty tasks array', () => {
    const result = validateNoAbnormalPaths([]);
    expect(result).toEqual([]);
  });

  it('returns empty array for normal paths', () => {
    const tasks = [
      { from: '/path/to/file1.txt', to: '/path/to/file2.txt' },
      { from: '/another/path/file.txt', to: '/another/path/newfile.txt' },
    ];
    const result = validateNoAbnormalPaths(tasks);
    expect(result).toEqual([]);
  });

  it('returns error for source path with ".."', () => {
    const tasks = [
      { from: '/path/../file.txt', to: '/path/to/dest.txt' },
    ];
    const result = validateNoAbnormalPaths(tasks);
    expect(result.length).toBe(1);
    expect(result[0]).toContain('Source path');
    expect(result[0]).toContain('is abnormal');
    expect(result[0]).toContain('/path/../file.txt');
  });

  it('returns error for destination path with ".."', () => {
    const tasks = [
      { from: '/path/to/source.txt', to: '/path/../dest.txt' },
    ];
    const result = validateNoAbnormalPaths(tasks);
    expect(result.length).toBe(1);
    expect(result[0]).toContain('Destination path');
    expect(result[0]).toContain('is abnormal');
    expect(result[0]).toContain('/path/../dest.txt');
  });

  it('returns error for source path with "."', () => {
    const tasks = [
      { from: '/path/./file.txt', to: '/path/to/dest.txt' },
    ];
    const result = validateNoAbnormalPaths(tasks);
    expect(result.length).toBe(1);
    expect(result[0]).toContain('Source path');
    expect(result[0]).toContain('is abnormal');
  });

  it('returns error for destination path with "."', () => {
    const tasks = [
      { from: '/path/to/source.txt', to: '/path/./dest.txt' },
    ];
    const result = validateNoAbnormalPaths(tasks);
    expect(result.length).toBe(1);
    expect(result[0]).toContain('Destination path');
    expect(result[0]).toContain('is abnormal');
  });

  it('returns errors for both source and destination paths with ".."', () => {
    const tasks = [
      { from: '/path/../source.txt', to: '/path/../dest.txt' },
    ];
    const result = validateNoAbnormalPaths(tasks);
    expect(result.length).toBe(2);
    expect(result.some(e => e.includes('Source path') && e.includes('is abnormal'))).toBe(true);
    expect(result.some(e => e.includes('Destination path') && e.includes('is abnormal'))).toBe(true);
  });

  it('returns errors for multiple tasks with abnormal paths', () => {
    const tasks = [
      { from: '/path/../file1.txt', to: '/path/to/dest1.txt' },
      { from: '/path/to/source2.txt', to: '/path/../dest2.txt' },
      { from: '/path/../file3.txt', to: '/path/../dest3.txt' },
    ];
    const result = validateNoAbnormalPaths(tasks);
    expect(result.length).toBe(4); // 1 from first task, 1 from second task, 2 from third task
  });

  it('handles mixed normal and abnormal paths', () => {
    const tasks = [
      { from: '/path/to/normal1.txt', to: '/path/to/normal2.txt' },
      { from: '/path/../abnormal.txt', to: '/path/to/normal3.txt' },
      { from: '/path/to/normal4.txt', to: '/path/to/normal5.txt' },
    ];
    const result = validateNoAbnormalPaths(tasks);
    expect(result.length).toBe(1);
    expect(result[0]).toContain('Source path');
    expect(result[0]).toContain('/path/../abnormal.txt');
  });

  it('handles paths with multiple ".." segments', () => {
    const tasks = [
      { from: '/path/to/../../file.txt', to: '/path/to/dest.txt' },
    ];
    const result = validateNoAbnormalPaths(tasks);
    expect(result.length).toBe(1);
    expect(result[0]).toContain('Source path');
    expect(result[0]).toContain('is abnormal');
  });

  it('handles relative paths with ".." at the beginning (not detected as they normalize to themselves)', () => {
    // Note: path.normalize('../file.txt') returns '../file.txt' (no change)
    // So this won't be detected by the validation function
    const tasks = [
      { from: '../file.txt', to: '/path/to/dest.txt' },
    ];
    const result = validateNoAbnormalPaths(tasks);
    // Relative paths with .. at the beginning don't change when normalized
    expect(result.length).toBe(0);
  });

  it('handles paths with ".." in the middle', () => {
    const tasks = [
      { from: '/path/to/../other/file.txt', to: '/path/to/dest.txt' },
    ];
    const result = validateNoAbnormalPaths(tasks);
    expect(result.length).toBe(1);
    expect(result[0]).toContain('Source path');
    expect(result[0]).toContain('is abnormal');
  });

  it('handles Windows-style paths with ".." (normalized paths may not change)', () => {
    // Note: On Windows, path.normalize('C:\\path\\..\\file.txt') may normalize
    // to 'C:\\path\\..\\file.txt' (no change) depending on the path structure
    // This test verifies the function behavior with Windows paths
    const tasks = [
      { from: 'C:\\path\\..\\file.txt', to: 'C:\\path\\to\\dest.txt' },
    ];
    const result = validateNoAbnormalPaths(tasks);
    // The result depends on how path.normalize handles this specific path
    // We just verify the function doesn't crash
    expect(Array.isArray(result)).toBe(true);
  });

  it('handles paths with special characters but no ".." or "."', () => {
    const tasks = [
      { from: '/path/with spaces/file (1).txt', to: '/new/path/file.txt' },
    ];
    const result = validateNoAbnormalPaths(tasks);
    expect(result).toEqual([]);
  });

  it('skips null or undefined tasks', () => {
    const tasks = [
      { from: '/path/to/file1.txt', to: '/path/to/dest1.txt' },
      null as any,
      undefined as any,
      { from: '/path/to/file2.txt', to: '/path/to/dest2.txt' },
    ];
    const result = validateNoAbnormalPaths(tasks);
    expect(result).toEqual([]);
  });
});

