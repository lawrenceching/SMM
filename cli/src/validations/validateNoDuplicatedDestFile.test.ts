import { describe, it, expect } from 'bun:test';
import { validateNoDuplicatedDestFile } from './validateNoDuplicatedDestFile';

describe('validateNoDuplicatedDestFile', () => {
  it('returns true for empty tasks array', () => {
    const result = validateNoDuplicatedDestFile([]);
    expect(result.isValid).toBe(true);
    expect(result.duplicates).toEqual([]);
  });

  it('returns true for single task', () => {
    const result = validateNoDuplicatedDestFile([
      { from: '/path/to/A', to: '/path/to/B' },
    ]);
    expect(result.isValid).toBe(true);
    expect(result.duplicates).toEqual([]);
  });

  it('returns true when no duplicate destination files exist', () => {
    const tasks = [
      { from: '/path/to/A', to: '/path/to/B' },
      { from: '/path/to/C', to: '/path/to/D' },
      { from: '/path/to/E', to: '/path/to/F' },
    ];
    const result = validateNoDuplicatedDestFile(tasks);
    expect(result.isValid).toBe(true);
    expect(result.duplicates).toEqual([]);
  });

  it('returns false when duplicate destination files exist', () => {
    const tasks = [
      { from: '/path/to/A', to: '/path/to/B' },
      { from: '/path/to/C', to: '/path/to/B' },
    ];
    const result = validateNoDuplicatedDestFile(tasks);
    expect(result.isValid).toBe(false);
    expect(result.duplicates).toEqual(['/path/to/B']);
  });

  it('returns false when multiple tasks point to the same destination', () => {
    const tasks = [
      { from: '/path/to/A', to: '/path/to/B' },
      { from: '/path/to/C', to: '/path/to/B' },
      { from: '/path/to/D', to: '/path/to/B' },
    ];
    const result = validateNoDuplicatedDestFile(tasks);
    expect(result.isValid).toBe(false);
    expect(result.duplicates).toEqual(['/path/to/B']);
  });

  it('returns false when multiple different destinations are duplicated', () => {
    const tasks = [
      { from: '/path/to/A', to: '/path/to/B' },
      { from: '/path/to/C', to: '/path/to/B' },
      { from: '/path/to/D', to: '/path/to/E' },
      { from: '/path/to/F', to: '/path/to/E' },
    ];
    const result = validateNoDuplicatedDestFile(tasks);
    expect(result.isValid).toBe(false);
    expect(result.duplicates).toContain('/path/to/B');
    expect(result.duplicates).toContain('/path/to/E');
    expect(result.duplicates.length).toBe(2);
  });

  it('handles paths with special characters', () => {
    const tasks = [
      { from: '/path/with spaces/file (1).txt', to: '/new/path/file.txt' },
      { from: '/another/path/file.doc', to: '/new/path/file.txt' },
    ];
    const result = validateNoDuplicatedDestFile(tasks);
    expect(result.isValid).toBe(false);
    expect(result.duplicates).toEqual(['/new/path/file.txt']);
  });

  it('handles tasks with same source but different destinations', () => {
    const tasks = [
      { from: '/path/to/A', to: '/path/to/B' },
      { from: '/path/to/A', to: '/path/to/C' },
    ];
    const result = validateNoDuplicatedDestFile(tasks);
    expect(result.isValid).toBe(true);
    expect(result.duplicates).toEqual([]);
  });

  it('handles empty destination strings as duplicates', () => {
    const tasks = [
      { from: '/path/to/A', to: '' },
      { from: '/path/to/B', to: '' },
    ];
    const result = validateNoDuplicatedDestFile(tasks);
    expect(result.isValid).toBe(false);
    expect(result.duplicates).toEqual(['']);
  });
});

