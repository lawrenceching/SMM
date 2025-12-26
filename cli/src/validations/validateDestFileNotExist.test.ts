import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { validateDestFileNotExist } from './validateDestFileNotExist';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { Path } from '@core/path';

describe('validateDestFileNotExist', () => {
  let testDir: string;
  let existingFile1: string;
  let existingFile2: string;
  let existingFile1Posix: string;
  let existingFile2Posix: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    testDir = join(tmpdir(), `smm-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    // Create existing files (these simulate files that already exist at destination)
    existingFile1 = join(testDir, 'existing1.txt');
    existingFile2 = join(testDir, 'existing2.txt');
    await writeFile(existingFile1, 'existing content 1');
    await writeFile(existingFile2, 'existing content 2');

    // Convert to POSIX format
    existingFile1Posix = Path.posix(existingFile1);
    existingFile2Posix = Path.posix(existingFile2);
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await unlink(existingFile1).catch(() => {});
      await unlink(existingFile2).catch(() => {});
    } catch {
      // Ignore cleanup errors
    }
  });

  it('returns true for empty tasks array', async () => {
    const result = await validateDestFileNotExist([]);
    expect(result.isValid).toBe(true);
    expect(result.existingFiles).toEqual([]);
  });

  it('returns true when all destination files do not exist', async () => {
    const tasks = [
      { from: '/path/to/source1.txt', to: '/path/to/nonexistent1.txt' },
      { from: '/path/to/source2.txt', to: '/path/to/nonexistent2.txt' },
    ];
    const result = await validateDestFileNotExist(tasks);
    expect(result.isValid).toBe(true);
    expect(result.existingFiles).toEqual([]);
  });

  it('returns false when destination file already exists', async () => {
    const tasks = [
      { from: '/path/to/source1.txt', to: existingFile1Posix },
      { from: '/path/to/source2.txt', to: '/path/to/nonexistent.txt' },
    ];
    const result = await validateDestFileNotExist(tasks);
    expect(result.isValid).toBe(false);
    expect(result.existingFiles).toContain(existingFile1Posix);
  });

  it('returns false when multiple destination files already exist', async () => {
    const tasks = [
      { from: '/path/to/source1.txt', to: existingFile1Posix },
      { from: '/path/to/source2.txt', to: existingFile2Posix },
    ];
    const result = await validateDestFileNotExist(tasks);
    expect(result.isValid).toBe(false);
    expect(result.existingFiles).toContain(existingFile1Posix);
    expect(result.existingFiles).toContain(existingFile2Posix);
    expect(result.existingFiles.length).toBe(2);
  });

  it('returns true when destination is a directory, not a file', async () => {
    const tasks = [
      { from: '/path/to/source1.txt', to: Path.posix(testDir) },
    ];
    const result = await validateDestFileNotExist(tasks);
    expect(result.isValid).toBe(true);
    expect(result.existingFiles).toEqual([]);
  });

  it('handles mixed existing and non-existing destination files', async () => {
    const tasks = [
      { from: '/path/to/source1.txt', to: '/path/to/nonexistent1.txt' },
      { from: '/path/to/source2.txt', to: existingFile1Posix },
      { from: '/path/to/source3.txt', to: '/path/to/nonexistent2.txt' },
    ];
    const result = await validateDestFileNotExist(tasks);
    expect(result.isValid).toBe(false);
    expect(result.existingFiles).toContain(existingFile1Posix);
    expect(result.existingFiles.length).toBe(1);
  });

  it('handles paths with special characters', async () => {
    const specialFile = join(testDir, 'file with spaces (1).txt');
    await writeFile(specialFile, 'existing content');
    const specialFilePosix = Path.posix(specialFile);

    const tasks = [
      { from: '/path/to/source.txt', to: specialFilePosix },
    ];
    const result = await validateDestFileNotExist(tasks);
    expect(result.isValid).toBe(false);
    expect(result.existingFiles).toContain(specialFilePosix);

    // Cleanup
    await unlink(specialFile).catch(() => {});
  });

  it('returns true when destination file does not exist (file system error)', async () => {
    const tasks = [
      { from: '/path/to/source.txt', to: '/nonexistent/path/file.txt' },
    ];
    const result = await validateDestFileNotExist(tasks);
    expect(result.isValid).toBe(true);
    expect(result.existingFiles).toEqual([]);
  });
});

