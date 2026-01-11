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

  describe('create mode', () => {
    it('should return error response when target file already exists', async () => {
      // Create an existing file using absolute path within mock user data dir
      const existingFileName = `existing-${Date.now()}.txt`;
      const existingFilePath = join(mockUserDataDir, existingFileName);
      const existingContent = 'This file already exists';
      await writeFile(existingFilePath, existingContent, 'utf-8');

      // Use absolute path in the request
      const request: WriteFileRequestBody = {
        path: existingFilePath,
        mode: 'create',
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
        mode: 'create',
        data: 'Hello, World!',
      };

      const result = await doWriteFile(request);

      expect(result.error).toBeUndefined();

      // Verify the file was written
      const file = Bun.file(newFilePath);
      const content = await file.text();
      expect(content).toBe('Hello, World!');
    });

    it('should verify content matches after successful create', async () => {
      const newFileName = `create-verify-${Date.now()}.txt`;
      const newFilePath = join(mockUserDataDir, newFileName);
      const testContent = 'Test content for create mode verification';

      const request: WriteFileRequestBody = {
        path: newFilePath,
        mode: 'create',
        data: testContent,
      };

      const result = await doWriteFile(request);

      expect(result.error).toBeUndefined();

      // Verify the file was written with correct content
      const file = Bun.file(newFilePath);
      const content = await file.text();
      expect(content).toBe(testContent);
    });
  });

  describe('overwrite mode', () => {
    it('should create and write to a new file', async () => {
      const newFileName = `overwrite-new-${Date.now()}.txt`;
      const newFilePath = join(mockUserDataDir, newFileName);

      const request: WriteFileRequestBody = {
        path: newFilePath,
        mode: 'overwrite',
        data: 'New file content',
      };

      const result = await doWriteFile(request);

      expect(result.error).toBeUndefined();

      // Verify the file was created and written
      const file = Bun.file(newFilePath);
      const content = await file.text();
      expect(content).toBe('New file content');
    });

    it('should overwrite existing file content', async () => {
      const filePath = join(mockUserDataDir, `overwrite-existing-${Date.now()}.txt`);
      const oldContent = 'Old content that should be replaced';
      await writeFile(filePath, oldContent, 'utf-8');

      const request: WriteFileRequestBody = {
        path: filePath,
        mode: 'overwrite',
        data: 'New content that replaces old',
      };

      const result = await doWriteFile(request);

      expect(result.error).toBeUndefined();

      // Verify the file content was replaced
      const file = Bun.file(filePath);
      const content = await file.text();
      expect(content).toBe('New content that replaces old');
      expect(content).not.toContain('Old content');
    });

    it('should verify content is replaced not appended', async () => {
      const filePath = join(mockUserDataDir, `overwrite-verify-${Date.now()}.txt`);
      const initialContent = 'Initial content';
      await writeFile(filePath, initialContent, 'utf-8');

      const request: WriteFileRequestBody = {
        path: filePath,
        mode: 'overwrite',
        data: 'Replaced content',
      };

      const result = await doWriteFile(request);

      expect(result.error).toBeUndefined();

      // Verify content is replaced, not appended
      const file = Bun.file(filePath);
      const content = await file.text();
      expect(content).toBe('Replaced content');
      expect(content).not.toBe('Initial contentReplaced content');
      expect(content.length).toBe('Replaced content'.length);
    });
  });

  describe('append mode', () => {
    it('should create new file and write content when file does not exist', async () => {
      const newFileName = `append-new-${Date.now()}.txt`;
      const newFilePath = join(mockUserDataDir, newFileName);

      const request: WriteFileRequestBody = {
        path: newFilePath,
        mode: 'append',
        data: 'Initial content from append',
      };

      const result = await doWriteFile(request);

      expect(result.error).toBeUndefined();

      // Verify the file was created and written
      const file = Bun.file(newFilePath);
      const content = await file.text();
      expect(content).toBe('Initial content from append');
    });

    it('should append to existing file content', async () => {
      const filePath = join(mockUserDataDir, `append-existing-${Date.now()}.txt`);
      const initialContent = 'Initial content\n';
      await writeFile(filePath, initialContent, 'utf-8');

      const request: WriteFileRequestBody = {
        path: filePath,
        mode: 'append',
        data: 'appended content',
      };

      const result = await doWriteFile(request);

      expect(result.error).toBeUndefined();

      // Verify content was appended
      const file = Bun.file(filePath);
      const content = await file.text();
      expect(content).toBe('Initial content\nappended content');
    });

    it('should append multiple times correctly', async () => {
      const filePath = join(mockUserDataDir, `append-multiple-${Date.now()}.txt`);
      const initialContent = 'Start';
      await writeFile(filePath, initialContent, 'utf-8');

      // First append
      const request1: WriteFileRequestBody = {
        path: filePath,
        mode: 'append',
        data: ' - First',
      };
      const result1 = await doWriteFile(request1);
      expect(result1.error).toBeUndefined();

      // Second append
      const request2: WriteFileRequestBody = {
        path: filePath,
        mode: 'append',
        data: ' - Second',
      };
      const result2 = await doWriteFile(request2);
      expect(result2.error).toBeUndefined();

      // Verify all content was appended correctly
      const file = Bun.file(filePath);
      const content = await file.text();
      expect(content).toBe('Start - First - Second');
    });

    it('should verify content is appended not overwritten', async () => {
      const filePath = join(mockUserDataDir, `append-verify-${Date.now()}.txt`);
      const initialContent = 'Original content';
      await writeFile(filePath, initialContent, 'utf-8');

      const request: WriteFileRequestBody = {
        path: filePath,
        mode: 'append',
        data: ' appended',
      };

      const result = await doWriteFile(request);

      expect(result.error).toBeUndefined();

      // Verify content is appended, not overwritten
      const file = Bun.file(filePath);
      const content = await file.text();
      expect(content).toBe('Original content appended');
      expect(content).toContain('Original content');
      expect(content.length).toBe('Original content appended'.length);
    });
  });

  describe('validation', () => {
    it('should return validation error when mode field is missing', async () => {
      const filePath = join(mockUserDataDir, `validation-${Date.now()}.txt`);

      const request = {
        path: filePath,
        data: 'test content',
        // mode is missing
      } as WriteFileRequestBody;

      const result = await doWriteFile(request);

      expect(result.error).toBeDefined();
      expect(result.error).toContain('Validation failed');
    });

    it('should return validation error for invalid mode value', async () => {
      const filePath = join(mockUserDataDir, `validation-invalid-${Date.now()}.txt`);

      const request = {
        path: filePath,
        mode: 'invalid-mode' as any,
        data: 'test content',
      };

      const result = await doWriteFile(request);

      expect(result.error).toBeDefined();
      expect(result.error).toContain('Validation failed');
    });

    it('should return validation error when data field is missing', async () => {
      const filePath = join(mockUserDataDir, `validation-data-${Date.now()}.txt`);

      const request = {
        path: filePath,
        mode: 'create',
        // data is missing
      } as WriteFileRequestBody;

      const result = await doWriteFile(request);

      expect(result.error).toBeDefined();
      expect(result.error).toContain('Validation failed');
    });

    it('should return validation error when path is empty', async () => {
      const request: WriteFileRequestBody = {
        path: '',
        mode: 'create',
        data: 'test content',
      };

      const result = await doWriteFile(request);

      expect(result.error).toBeDefined();
      expect(result.error).toContain('Validation failed');
    });
  });

  describe('edge cases', () => {
    it('should create nested directories automatically', async () => {
      const nestedDir = join(mockUserDataDir, 'nested', 'subdir');
      const filePath = join(nestedDir, `nested-file-${Date.now()}.txt`);

      const request: WriteFileRequestBody = {
        path: filePath,
        mode: 'create',
        data: 'Content in nested directory',
      };

      const result = await doWriteFile(request);

      expect(result.error).toBeUndefined();

      // Verify the file was created in nested directory
      const file = Bun.file(filePath);
      const content = await file.text();
      expect(content).toBe('Content in nested directory');
    });

    it('should handle content with newlines', async () => {
      const filePath = join(mockUserDataDir, `newlines-${Date.now()}.txt`);
      const contentWithNewlines = 'Line 1\nLine 2\nLine 3';

      const request: WriteFileRequestBody = {
        path: filePath,
        mode: 'create',
        data: contentWithNewlines,
      };

      const result = await doWriteFile(request);

      expect(result.error).toBeUndefined();

      const file = Bun.file(filePath);
      const content = await file.text();
      expect(content).toBe(contentWithNewlines);
    });

    it('should handle unicode characters in content', async () => {
      const filePath = join(mockUserDataDir, `unicode-${Date.now()}.txt`);
      const unicodeContent = 'Hello 世界 🌍 こんにちは';

      const request: WriteFileRequestBody = {
        path: filePath,
        mode: 'create',
        data: unicodeContent,
      };

      const result = await doWriteFile(request);

      expect(result.error).toBeUndefined();

      const file = Bun.file(filePath);
      const content = await file.text();
      expect(content).toBe(unicodeContent);
    });

    it('should handle empty content string', async () => {
      const filePath = join(mockUserDataDir, `empty-${Date.now()}.txt`);

      const request: WriteFileRequestBody = {
        path: filePath,
        mode: 'create',
        data: '',
      };

      const result = await doWriteFile(request);

      expect(result.error).toBeUndefined();

      const file = Bun.file(filePath);
      const content = await file.text();
      expect(content).toBe('');
    });

    it('should handle append with empty content', async () => {
      const filePath = join(mockUserDataDir, `append-empty-${Date.now()}.txt`);
      await writeFile(filePath, 'Initial', 'utf-8');

      const request: WriteFileRequestBody = {
        path: filePath,
        mode: 'append',
        data: '',
      };

      const result = await doWriteFile(request);

      expect(result.error).toBeUndefined();

      const file = Bun.file(filePath);
      const content = await file.text();
      expect(content).toBe('Initial');
    });
  });
});
