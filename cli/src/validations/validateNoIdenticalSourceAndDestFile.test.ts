import { describe, it, expect } from 'bun:test';
import { validateNoIdenticalSourceAndDestFile } from './validateNoIdenticalSourceAndDestFile';

describe('validateNoIdenticalSourceAndDestFile', () => {
  it('returns valid for empty array', () => {
    const result = validateNoIdenticalSourceAndDestFile([]);
    expect(result.isValid).toBe(true);
    expect(result.identicals).toHaveLength(0);
  });

  it('returns valid for different source and destination', () => {
    const tasks = [
      { from: '/path/to/file1.txt', to: '/path/to/renamed1.txt' },
      { from: '/path/to/file2.txt', to: '/path/to/renamed2.txt' },
    ];
    const result = validateNoIdenticalSourceAndDestFile(tasks);
    expect(result.isValid).toBe(true);
    expect(result.identicals).toHaveLength(0);
  });

  it('detects identical source and destination', () => {
    const tasks = [
      { from: '/path/to/file.txt', to: '/path/to/file.txt' },
    ];
    const result = validateNoIdenticalSourceAndDestFile(tasks);
    expect(result.isValid).toBe(false);
    expect(result.identicals).toEqual(['/path/to/file.txt']);
  });

  it('detects multiple identical source and destination', () => {
    const tasks = [
      { from: '/path/to/file1.txt', to: '/path/to/file1.txt' },
      { from: '/path/to/file2.txt', to: '/path/to/renamed.txt' },
      { from: '/path/to/file3.txt', to: '/path/to/file3.txt' },
    ];
    const result = validateNoIdenticalSourceAndDestFile(tasks);
    expect(result.isValid).toBe(false);
    expect(result.identicals).toContain('/path/to/file1.txt');
    expect(result.identicals).toContain('/path/to/file3.txt');
    expect(result.identicals).toHaveLength(2);
  });

  it('handles tasks with undefined entries', () => {
    const tasks = [
      { from: '/path/to/file.txt', to: '/path/to/file.txt' },
      undefined as any,
    ];
    const result = validateNoIdenticalSourceAndDestFile(tasks);
    expect(result.isValid).toBe(false);
    expect(result.identicals).toEqual(['/path/to/file.txt']);
  });

  it('handles paths with special characters', () => {
    const tasks = [
      { from: '/path/with spaces/file.txt', to: '/path/with spaces/file.txt' },
    ];
    const result = validateNoIdenticalSourceAndDestFile(tasks);
    expect(result.isValid).toBe(false);
    expect(result.identicals).toEqual(['/path/with spaces/file.txt']);
  });

  it('handles Windows paths', () => {
    const tasks = [
      { from: 'C:\\media\\file.txt', to: 'C:\\media\\file.txt' },
    ];
    const result = validateNoIdenticalSourceAndDestFile(tasks);
    expect(result.isValid).toBe(false);
    expect(result.identicals).toEqual(['C:\\media\\file.txt']);
  });

  it('distinguishes between similar but different paths', () => {
    const tasks = [
      { from: '/path/to/file.txt', to: '/path/to/file .txt' },
      { from: '/path/to/file.txt', to: '/path/to/file.txt' },
    ];
    const result = validateNoIdenticalSourceAndDestFile(tasks);
    expect(result.isValid).toBe(false);
    expect(result.identicals).toHaveLength(1);
    expect(result.identicals[0]).toBe('/path/to/file.txt');
  });
});
