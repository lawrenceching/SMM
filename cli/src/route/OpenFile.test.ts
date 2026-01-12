import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Hono } from 'hono';
import type { OpenFileRequestBody } from '@core/types';

// Mock variables that can be controlled in tests
let mockIsDesktopEnvReturn = true;
let mockOpenFileImpl: ((path: string) => void) | null = null;
let openFileCalledWith: string | null = null;

// Set up the mock before importing the handler
mock.module('../utils/os', () => ({
  isDesktopEnv: () => mockIsDesktopEnvReturn,
  openFile: (path: string) => {
    openFileCalledWith = path;
    if (mockOpenFileImpl) {
      mockOpenFileImpl(path);
    }
  },
}));

// Import after mock is set up
const { handleOpenFile } = await import('./OpenFile');

describe('handleOpenFile', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    handleOpenFile(app);
    
    // Reset mocks to default behavior
    mockIsDesktopEnvReturn = true;
    mockOpenFileImpl = null;
    openFileCalledWith = null;
  });

  describe('validation', () => {
    it('should return error when path is missing', async () => {
      const requestBody = {} as OpenFileRequestBody;

      const res = await app.request('/api/openFile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      expect(res.status).toBe(200);
      const response = await res.json();
      expect(response.error).toBe('Validation Failed: Path is required and must be a string');
      expect(response.data.path).toBe('');
    });

    it('should return error when path is empty string', async () => {
      const requestBody: OpenFileRequestBody = {
        path: '',
      };

      const res = await app.request('/api/openFile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      expect(res.status).toBe(200);
      const response = await res.json();
      expect(response.error).toBe('Validation Failed: Path is required and must be a string');
      expect(response.data.path).toBe('');
    });

    it('should return error when path is not a string', async () => {
      const requestBody = {
        path: 123,
      } as any;

      const res = await app.request('/api/openFile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      expect(res.status).toBe(200);
      const response = await res.json();
      expect(response.error).toBe('Validation Failed: Path is required and must be a string');
      expect(response.data.path).toBe(123);
    });

    it('should return error when path is null', async () => {
      const requestBody = {
        path: null,
      } as any;

      const res = await app.request('/api/openFile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      expect(res.status).toBe(200);
      const response = await res.json();
      expect(response.error).toBe('Validation Failed: Path is required and must be a string');
      expect(response.data.path).toBe('');
    });
  });

  describe('desktop environment check', () => {
    it('should return error when not in desktop environment', async () => {
      mockIsDesktopEnvReturn = false;
      
      const requestBody: OpenFileRequestBody = {
        path: '/path/to/file.jpg',
      };

      const res = await app.request('/api/openFile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      expect(res.status).toBe(200);
      const response = await res.json();
      expect(response.error).toBe('Not running in desktop environment. This operation requires a desktop environment.');
      expect(response.data.path).toBe('/path/to/file.jpg');
    });

    it('should proceed when in desktop environment', async () => {
      mockIsDesktopEnvReturn = true;
      
      const requestBody: OpenFileRequestBody = {
        path: '/path/to/file.jpg',
      };

      const res = await app.request('/api/openFile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      expect(res.status).toBe(200);
      const response = await res.json();
      expect(response.error).toBeUndefined();
      expect(response.data.path).toBe('/path/to/file.jpg');
      expect(openFileCalledWith).toBe('/path/to/file.jpg');
    });
  });

  describe('successful file opening', () => {
    it('should successfully open a file', async () => {
      mockIsDesktopEnvReturn = true;
      
      const requestBody: OpenFileRequestBody = {
        path: '/path/to/image.png',
      };

      const res = await app.request('/api/openFile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      expect(res.status).toBe(200);
      const response = await res.json();
      expect(response.error).toBeUndefined();
      expect(response.data.path).toBe('/path/to/image.png');
      expect(openFileCalledWith).toBe('/path/to/image.png');
    });

    it('should handle Windows paths', async () => {
      mockIsDesktopEnvReturn = true;
      
      const requestBody: OpenFileRequestBody = {
        path: 'C:\\Users\\test\\file.jpg',
      };

      const res = await app.request('/api/openFile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      expect(res.status).toBe(200);
      const response = await res.json();
      expect(response.error).toBeUndefined();
      expect(response.data.path).toBe('C:\\Users\\test\\file.jpg');
      expect(openFileCalledWith).toBe('C:\\Users\\test\\file.jpg');
    });

    it('should handle paths with spaces', async () => {
      mockIsDesktopEnvReturn = true;
      
      const requestBody: OpenFileRequestBody = {
        path: '/path/to/file with spaces.jpg',
      };

      const res = await app.request('/api/openFile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      expect(res.status).toBe(200);
      const response = await res.json();
      expect(response.error).toBeUndefined();
      expect(response.data.path).toBe('/path/to/file with spaces.jpg');
      expect(openFileCalledWith).toBe('/path/to/file with spaces.jpg');
    });
  });

  describe('error handling', () => {
    it('should handle error when openFile throws', async () => {
      mockIsDesktopEnvReturn = true;
      mockOpenFileImpl = () => {
        throw new Error('Failed to open file: Permission denied');
      };
      
      const requestBody: OpenFileRequestBody = {
        path: '/path/to/file.jpg',
      };

      const res = await app.request('/api/openFile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      expect(res.status).toBe(200);
      const response = await res.json();
      expect(response.error).toBe('Open File Failed: Failed to open file: Permission denied');
      expect(response.data.path).toBe('/path/to/file.jpg');
    });

    it('should handle non-Error exceptions', async () => {
      mockIsDesktopEnvReturn = true;
      mockOpenFileImpl = () => {
        throw 'String error';
      };
      
      const requestBody: OpenFileRequestBody = {
        path: '/path/to/file.jpg',
      };

      const res = await app.request('/api/openFile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      expect(res.status).toBe(200);
      const response = await res.json();
      expect(response.error).toBe('Open File Failed: Unknown error occurred');
      expect(response.data.path).toBe('/path/to/file.jpg');
    });

    it('should handle JSON parsing errors', async () => {
      const res = await app.request('/api/openFile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      expect(res.status).toBe(200);
      const response = await res.json();
      expect(response.error).toBeDefined();
      expect(response.error).toContain('Unexpected Error');
      expect(response.data.path).toBe('');
    });
  });
});
