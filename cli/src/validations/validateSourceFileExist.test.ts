import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { validateSourceFileExist } from './validateSourceFileExist';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { Path } from '@core/path';

describe('validateSourceFileExist', () => {
  let testDir: string;
  let testFile1: string;
  let testFile2: string;
  let testFile1Posix: string;
  let testFile2Posix: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    testDir = join(tmpdir(), `smm-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    // Create test files
    testFile1 = join(testDir, 'file1.txt');
    testFile2 = join(testDir, 'file2.txt');
    await writeFile(testFile1, 'test content 1');
    await writeFile(testFile2, 'test content 2');

    // Convert to POSIX format
    testFile1Posix = Path.posix(testFile1);
    testFile2Posix = Path.posix(testFile2);
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await unlink(testFile1).catch(() => {});
      await unlink(testFile2).catch(() => {});
    } catch {
      // Ignore cleanup errors
    }
  });

  it('returns true for empty tasks array', async () => {
    const result = await validateSourceFileExist([]);
    expect(result.isValid).toBe(true);
    expect(result.missingFiles).toEqual([]);
  });

  it('returns true when all source files exist', async () => {
    const tasks = [
      { from: testFile1Posix, to: '/path/to/dest1.txt' },
      { from: testFile2Posix, to: '/path/to/dest2.txt' },
    ];
    const result = await validateSourceFileExist(tasks);
    expect(result.isValid).toBe(true);
    expect(result.missingFiles).toEqual([]);
  });

  it('returns false when source file does not exist', async () => {
    const tasks = [
      { from: testFile1Posix, to: '/path/to/dest1.txt' },
      { from: '/path/to/nonexistent/file.txt', to: '/path/to/dest2.txt' },
    ];
    const result = await validateSourceFileExist(tasks);
    expect(result.isValid).toBe(false);
    expect(result.missingFiles).toContain('/path/to/nonexistent/file.txt');
  });

  it('returns false when multiple source files do not exist', async () => {
    const tasks = [
      { from: '/path/to/nonexistent1.txt', to: '/path/to/dest1.txt' },
      { from: '/path/to/nonexistent2.txt', to: '/path/to/dest2.txt' },
    ];
    const result = await validateSourceFileExist(tasks);
    expect(result.isValid).toBe(false);
    expect(result.missingFiles).toContain('/path/to/nonexistent1.txt');
    expect(result.missingFiles).toContain('/path/to/nonexistent2.txt');
    expect(result.missingFiles.length).toBe(2);
  });

  it('returns false when source file is a directory, not a file', async () => {
    const tasks = [
      { from: Path.posix(testDir), to: '/path/to/dest1.txt' },
    ];
    const result = await validateSourceFileExist(tasks);
    expect(result.isValid).toBe(false);
    expect(result.missingFiles).toContain(Path.posix(testDir));
  });

  it('handles mixed existing and non-existing files', async () => {
    const tasks = [
      { from: testFile1Posix, to: '/path/to/dest1.txt' },
      { from: '/path/to/nonexistent.txt', to: '/path/to/dest2.txt' },
      { from: testFile2Posix, to: '/path/to/dest3.txt' },
    ];
    const result = await validateSourceFileExist(tasks);
    expect(result.isValid).toBe(false);
    expect(result.missingFiles).toContain('/path/to/nonexistent.txt');
    expect(result.missingFiles.length).toBe(1);
  });

  it('handles paths with special characters', async () => {
    const specialFile = join(testDir, 'file with spaces (1).txt');
    await writeFile(specialFile, 'test content');
    const specialFilePosix = Path.posix(specialFile);

    const tasks = [
      { from: specialFilePosix, to: '/path/to/dest.txt' },
    ];
    const result = await validateSourceFileExist(tasks);
    expect(result.isValid).toBe(true);
    expect(result.missingFiles).toEqual([]);

    // Cleanup
    await unlink(specialFile).catch(() => {});
  });
});

