import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import type { ReadFileRequestBody } from '@core/types';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// Variable to hold the mock user data dir that the mock function can access
let currentMockUserDataDir: string;

// Set up the mock before any imports
mock.module('@/utils/config', () => ({
  getUserDataDir: () => currentMockUserDataDir,
  getUserConfig: async () => ({ folders: [] }),
  getLogDir: () => join(currentMockUserDataDir, 'logs'),
  getUserConfigPath: () => join(currentMockUserDataDir, 'smm.json'),
  writeUserConfig: async () => {},
}));

// Import after mock is set up
const { processReadFile } = await import('./ReadFile');

describe('processReadFile', () => {
  let mockUserDataDir: string;
  let testFilePath: string;
  let testFileContent: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    mockUserDataDir = join(tmpdir(), `smm-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await mkdir(mockUserDataDir, { recursive: true });
    
    // Update the mock variable
    currentMockUserDataDir = mockUserDataDir;
    
    // Create a test file
    testFileContent = 'Hello, World!\nThis is a test file.';
    testFilePath = join(mockUserDataDir, 'test.txt');
    await writeFile(testFilePath, testFileContent, 'utf-8');
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await rm(mockUserDataDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should successfully read a file within user data dir', async () => {
    const request: ReadFileRequestBody = {
      path: testFilePath,
    };

    const result = await processReadFile(request);

    expect(result.error).toBeUndefined();
    expect(result.data).toBe(testFileContent);
  });

  it('should successfully read a file with relative path', async () => {
    // Create a nested file
    const nestedDir = join(mockUserDataDir, 'nested');
    await mkdir(nestedDir, { recursive: true });
    const nestedFile = join(nestedDir, 'nested.txt');
    const nestedContent = 'Nested file content';
    await writeFile(nestedFile, nestedContent, 'utf-8');

    const request: ReadFileRequestBody = {
      path: nestedFile,
    };

    const result = await processReadFile(request);

    expect(result.error).toBeUndefined();
    expect(result.data).toBe(nestedContent);
  });

  it('should return error when file does not exist', async () => {
    const nonexistentPath = join(mockUserDataDir, 'nonexistent.txt');
    const request: ReadFileRequestBody = {
      path: nonexistentPath,
    };

    const result = await processReadFile(request);

    expect(result.data).toBeUndefined();
    expect(result.error).toBe(`File Not Found: ${nonexistentPath}`);
  });

  it('should return error when path is empty', async () => {
    const request: ReadFileRequestBody = {
      path: '',
    };

    const result = await processReadFile(request);

    expect(result.data).toBeUndefined();
    expect(result.error).toContain('Validation failed');
    expect(result.error).toContain('Path is required');
  });

  it('should return error when path is missing', async () => {
    const request = {} as ReadFileRequestBody;

    const result = await processReadFile(request);

    expect(result.data).toBeUndefined();
    expect(result.error).toContain('Validation failed');
  });

  it('should return error when path is outside user data dir', async () => {
    // Use a path that's definitely outside the user data dir
    const outsidePath = process.platform === 'win32' 
      ? 'C:\\Windows\\System32\\config\\sam'
      : '/etc/passwd';
    const request: ReadFileRequestBody = {
      path: outsidePath,
    };

    const result = await processReadFile(request);

    expect(result.data).toBeUndefined();
    expect(result.error).toContain('not in the allowlist');
  });

  it('should handle absolute path within user data dir', async () => {
    // Create another file
    const anotherFile = join(mockUserDataDir, 'another.txt');
    const anotherContent = 'Another file';
    await writeFile(anotherFile, anotherContent, 'utf-8');

    // Use absolute path (should still work if it's within user data dir)
    const request: ReadFileRequestBody = {
      path: anotherFile,
    };

    const result = await processReadFile(request);

    expect(result.error).toBeUndefined();
    expect(result.data).toBe(anotherContent);
  });

  it('should handle file with special characters in content', async () => {
    const specialContent = 'File with special chars: \n\t\r\nUnicode: 你好世界 🌍';
    const specialFile = join(mockUserDataDir, 'special.txt');
    await writeFile(specialFile, specialContent, 'utf-8');

    const request: ReadFileRequestBody = {
      path: specialFile,
    };

    const result = await processReadFile(request);

    expect(result.error).toBeUndefined();
    expect(result.data).toBe(specialContent);
  });

  it('should handle empty file', async () => {
    const emptyFile = join(mockUserDataDir, 'empty.txt');
    await writeFile(emptyFile, '', 'utf-8');

    const request: ReadFileRequestBody = {
      path: emptyFile,
    };

    const result = await processReadFile(request);

    expect(result.error).toBeUndefined();
    expect(result.data).toBe('');
  });
});
