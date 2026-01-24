import { describe, it, expect, beforeEach, afterEach, afterAll, mock } from 'bun:test';
import { tmpdir } from 'os';
import { join } from 'path';
import { rm } from 'fs/promises';

// Import real modules before mocking
import * as configModule from '@/utils/config';
import * as socketIOModule from '../utils/socketIO';

// Create spread objects with real function references
const realConfigModule = { ...configModule };
const realSocketIOModule = { ...socketIOModule };

// Variable to hold the mock user data dir
let currentMockUserDataDir: string;
let broadcastCalls: Array<{ event: string; data: any }> = [];

// Set up mocks before imports
mock.module('@/utils/config', () => ({
  getUserDataDir: () => currentMockUserDataDir,
  getUserConfig: async () => ({ folders: [] }),
  getLogDir: () => join(currentMockUserDataDir, 'logs'),
  getUserConfigPath: () => join(currentMockUserDataDir, 'smm.json'),
  writeUserConfig: async () => {},
}));

mock.module('../utils/socketIO', () => ({
  ...realSocketIOModule,
  broadcast: (message: { event: string; data: any }) => {
    broadcastCalls.push(message);
  },
}));

// Import after mocks are set up
const {
  beginRecognizeTask,
  addRecognizedMediaFile,
  getTask,
  endRecognizeTask,
} = await import('./recognizeMediaFilesTool');
import { RecognizeMediaFilePlanReady } from '@core/event-types';
import type { RecognizedFile } from '@core/types/RecognizeMediaFilePlan';

describe('recognizeMediaFilesTool', () => {
  let testUserDataDir: string;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    testUserDataDir = join(tmpdir(), `smm-recognition-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    currentMockUserDataDir = testUserDataDir;
    broadcastCalls = [];
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await rm(testUserDataDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
    broadcastCalls = [];
  });

  afterAll(() => {
    // Restore all modules
    mock.restore();
    mock.module('@/utils/config', () => ({ ...realConfigModule }));
    mock.module('../utils/socketIO', () => ({ ...realSocketIOModule }));
  });

  describe('beginRecognizeTask', () => {
    it('should create a new recognition task and return task ID', async () => {
      const mediaFolderPath = '/path/to/media/folder';
      
      const taskId = await beginRecognizeTask(mediaFolderPath);
      
      expect(taskId).toBeDefined();
      expect(typeof taskId).toBe('string');
      expect(taskId.length).toBeGreaterThan(0);
      
      // Verify plan file was created
      const task = await getTask(taskId);
      expect(task).toBeDefined();
      expect(task?.task).toBe('recognize-media-file');
      expect(task?.mediaFolderPath).toBe('/path/to/media/folder');
      expect(task?.files).toEqual([]);
    });

    it('should convert Windows path to POSIX format', async () => {
      const mediaFolderPath = 'C:\\Users\\test\\media';
      
      const taskId = await beginRecognizeTask(mediaFolderPath);
      
      const task = await getTask(taskId);
      expect(task?.mediaFolderPath).not.toContain('\\');
      expect(task?.mediaFolderPath).toContain('/');
    });
  });

  describe('addRecognizedMediaFile', () => {
    it('should add a recognized file to an existing task', async () => {
      const mediaFolderPath = '/path/to/media/folder';
      const taskId = await beginRecognizeTask(mediaFolderPath);
      
      const recognizedFile: RecognizedFile = {
        season: 1,
        episode: 5,
        path: '/path/to/file.mp4',
      };
      
      await addRecognizedMediaFile(taskId, recognizedFile);
      
      const task = await getTask(taskId);
      expect(task?.files).toHaveLength(1);
      expect(task?.files[0]).toEqual({
        season: 1,
        episode: 5,
        path: '/path/to/file.mp4',
      });
    });

    it('should add multiple files to a task', async () => {
      const mediaFolderPath = '/path/to/media/folder';
      const taskId = await beginRecognizeTask(mediaFolderPath);
      
      await addRecognizedMediaFile(taskId, { season: 1, episode: 1, path: '/path/to/file1.mp4' });
      await addRecognizedMediaFile(taskId, { season: 1, episode: 2, path: '/path/to/file2.mp4' });
      await addRecognizedMediaFile(taskId, { season: 2, episode: 1, path: '/path/to/file3.mp4' });
      
      const task = await getTask(taskId);
      expect(task?.files).toHaveLength(3);
    });

    it('should convert Windows path to POSIX format', async () => {
      const mediaFolderPath = '/path/to/media/folder';
      const taskId = await beginRecognizeTask(mediaFolderPath);
      
      const recognizedFile: RecognizedFile = {
        season: 1,
        episode: 1,
        path: 'C:\\Users\\test\\file.mp4',
      };
      
      await addRecognizedMediaFile(taskId, recognizedFile);
      
      const task = await getTask(taskId);
      expect(task?.files[0]?.path).not.toContain('\\');
      expect(task?.files[0]?.path).toContain('/');
    });

    it('should throw error if task does not exist', async () => {
      const nonExistentTaskId = 'non-existent-task-id';
      const recognizedFile: RecognizedFile = {
        season: 1,
        episode: 1,
        path: '/path/to/file.mp4',
      };
      
      await expect(addRecognizedMediaFile(nonExistentTaskId, recognizedFile)).rejects.toThrow(
        'Task with id non-existent-task-id not found'
      );
    });
  });

  describe('getTask', () => {
    it('should return task if it exists', async () => {
      const mediaFolderPath = '/path/to/media/folder';
      const taskId = await beginRecognizeTask(mediaFolderPath);
      
      const task = await getTask(taskId);
      
      expect(task).toBeDefined();
      expect(task?.task).toBe('recognize-media-file');
      expect(task?.mediaFolderPath).toBe('/path/to/media/folder');
      expect(task?.files).toEqual([]);
    });

    it('should return undefined if task does not exist', async () => {
      const nonExistentTaskId = 'non-existent-task-id';
      
      const task = await getTask(nonExistentTaskId);
      
      expect(task).toBeUndefined();
    });
  });

  describe('endRecognizeTask', () => {
    it('should broadcast recognition plan ready event', async () => {
      const mediaFolderPath = '/path/to/media/folder';
      const taskId = await beginRecognizeTask(mediaFolderPath);
      
      await addRecognizedMediaFile(taskId, { season: 1, episode: 1, path: '/path/to/file1.mp4' });
      await addRecognizedMediaFile(taskId, { season: 1, episode: 2, path: '/path/to/file2.mp4' });
      
      await endRecognizeTask(taskId);
      
      expect(broadcastCalls).toHaveLength(1);
      expect(broadcastCalls[0]?.event).toBe(RecognizeMediaFilePlanReady.event);
      expect(broadcastCalls[0]?.data.taskId).toBe(taskId);
      expect(broadcastCalls[0]?.data.planFilePath).toBeDefined();
      expect(broadcastCalls[0]?.data.planFilePath).toContain('.plan.json');
    });

    it('should throw error if task does not exist', async () => {
      const nonExistentTaskId = 'non-existent-task-id';
      
      await expect(endRecognizeTask(nonExistentTaskId)).rejects.toThrow(
        'Task with id non-existent-task-id not found'
      );
    });

    it('should include plan file path in POSIX format', async () => {
      const mediaFolderPath = '/path/to/media/folder';
      const taskId = await beginRecognizeTask(mediaFolderPath);
      
      await addRecognizedMediaFile(taskId, { season: 1, episode: 1, path: '/path/to/file1.mp4' });
      
      await endRecognizeTask(taskId);
      
      const planFilePath = broadcastCalls[0]?.data.planFilePath;
      expect(planFilePath).toBeDefined();
      expect(planFilePath).not.toContain('\\');
      expect(planFilePath).toContain('/');
    });
  });
});
