import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import type { WriteFileRequestBody } from '@core/types';
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
  renameFolderInUserConfig: (userConfig: Record<string, unknown>, from: string, to: string) => userConfig,
}));

mock.module('@/core/errors', () => ({
  isError: (error: string, _message: string) => typeof error === 'string' && error.startsWith('File Already Existed:'),
  ExistedFileError: 'File Already Existed',
  existedFileError: (path: string) => `File Already Existed: ${path}`,
}));

// Import after mock is set up
const { doWriteFile } = await import('./WriteFile');

describe('doWriteFile', () => {
  let mockUserDataDir: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    mockUserDataDir = join(tmpdir(), `smm-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await mkdir(mockUserDataDir, { recursive: true });

    // Update the mock variable
    currentMockUserDataDir = mockUserDataDir;
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await rm(mockUserDataDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should return error response when target file already exists', async () => {
    // Create an existing file using absolute path within mock user data dir
    const existingFileName = `existing-${Date.now()}.txt`;
    const existingFilePath = join(mockUserDataDir, existingFileName);
    const existingContent = 'This file already exists';
    await writeFile(existingFilePath, existingContent, 'utf-8');

    // Use absolute path in the request
    const request: WriteFileRequestBody = {
      path: existingFilePath,
      data: 'New content to write',
    };

    const result = await doWriteFile(request);

    expect(result.error).toBeDefined();
    expect(result.error).toContain('File Already Existed');
  });

  it('should successfully write a new file', async () => {
    const newFileName = `newfile-${Date.now()}.txt`;
    const newFilePath = join(mockUserDataDir, newFileName);

    // Use absolute path in the request
    const request: WriteFileRequestBody = {
      path: newFilePath,
      data: 'Hello, World!',
    };

    const result = await doWriteFile(request);

    expect(result.error).toBeUndefined();

    // Verify the file was written
    const file = Bun.file(newFilePath);
    const content = await file.text();
    expect(content).toBe('Hello, World!');
  });
});
