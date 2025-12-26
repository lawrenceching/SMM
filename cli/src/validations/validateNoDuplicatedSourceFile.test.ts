import { describe, it, expect } from 'bun:test';
import { validateNoDuplicatedSourceFile } from './validateNoDuplicatedSourceFile';

describe('validateNoDuplicatedSourceFile', () => {
  it('returns valid for empty array', () => {
    const result = validateNoDuplicatedSourceFile([]);
    expect(result.isValid).toBe(true);
    expect(result.duplicates).toHaveLength(0);
  });

  it('returns valid for single task', () => {
    const tasks = [
      { from: '/path/to/file.txt', to: '/path/to/renamed.txt' },
    ];
    const result = validateNoDuplicatedSourceFile(tasks);
    expect(result.isValid).toBe(true);
    expect(result.duplicates).toHaveLength(0);
  });

  it('returns valid for unique source files', () => {
    const tasks = [
      { from: '/path/to/file1.txt', to: '/path/to/renamed1.txt' },
      { from: '/path/to/file2.txt', to: '/path/to/renamed2.txt' },
      { from: '/path/to/file3.txt', to: '/path/to/renamed3.txt' },
    ];
    const result = validateNoDuplicatedSourceFile(tasks);
    expect(result.isValid).toBe(true);
    expect(result.duplicates).toHaveLength(0);
  });

  it('detects duplicate source files', () => {
    const tasks = [
      { from: '/path/to/file.txt', to: '/path/to/renamed1.txt' },
      { from: '/path/to/file.txt', to: '/path/to/renamed2.txt' },
    ];
    const result = validateNoDuplicatedSourceFile(tasks);
    expect(result.isValid).toBe(false);
    expect(result.duplicates).toEqual(['/path/to/file.txt']);
  });

  it('detects multiple duplicate source files', () => {
    const tasks = [
      { from: '/path/to/fileA.txt', to: '/path/to/renamed1.txt' },
      { from: '/path/to/fileB.txt', to: '/path/to/renamed2.txt' },
      { from: '/path/to/fileA.txt', to: '/path/to/renamed3.txt' },
      { from: '/path/to/fileB.txt', to: '/path/to/renamed4.txt' },
      { from: '/path/to/fileC.txt', to: '/path/to/renamed5.txt' },
    ];
    const result = validateNoDuplicatedSourceFile(tasks);
    expect(result.isValid).toBe(false);
    expect(result.duplicates).toContain('/path/to/fileA.txt');
    expect(result.duplicates).toContain('/path/to/fileB.txt');
    expect(result.duplicates).toHaveLength(2);
  });

  it('handles tasks with undefined entries', () => {
    const tasks = [
      { from: '/path/to/file1.txt', to: '/path/to/renamed1.txt' },
      undefined as any,
      { from: '/path/to/file1.txt', to: '/path/to/renamed2.txt' },
    ];
    const result = validateNoDuplicatedSourceFile(tasks);
    expect(result.isValid).toBe(false);
    expect(result.duplicates).toEqual(['/path/to/file1.txt']);
  });

  it('handles paths with special characters', () => {
    const tasks = [
      { from: '/path/with spaces/file.txt', to: '/path/renamed1.txt' },
      { from: '/path/with spaces/file.txt', to: '/path/renamed2.txt' },
    ];
    const result = validateNoDuplicatedSourceFile(tasks);
    expect(result.isValid).toBe(false);
    expect(result.duplicates).toEqual(['/path/with spaces/file.txt']);
  });

  it('handles Windows paths', () => {
    const tasks = [
      { from: 'C:\\media\\file.txt', to: 'D:\\renamed1.txt' },
      { from: 'C:\\media\\file.txt', to: 'D:\\renamed2.txt' },
    ];
    const result = validateNoDuplicatedSourceFile(tasks);
    expect(result.isValid).toBe(false);
    expect(result.duplicates).toEqual(['C:\\media\\file.txt']);
  });
});
