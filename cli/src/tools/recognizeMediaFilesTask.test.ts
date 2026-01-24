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
  createBeginRecognizeTaskTool,
  createAddRecognizedMediaFileTool,
  createEndRecognizeTaskTool,
} = await import('./recognizeMediaFilesTask');

const clientId = 'test-client-id';

describe('recognizeMediaFilesTask', () => {
  let testUserDataDir: string;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    testUserDataDir = join(tmpdir(), `smm-recognition-task-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
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

  describe('createBeginRecognizeTaskTool', () => {
    it('should have correct tool name and description', () => {
      const tool = createBeginRecognizeTaskTool(clientId);
      
      expect(tool.toolName).toBe('beginRecognizeTask');
      expect(tool.description).toContain('Begin a media file recognition task');
    });

    it('should create a task and return task ID', async () => {
      const tool = createBeginRecognizeTaskTool(clientId);
      const mediaFolderPath = '/path/to/media/folder';
      
      const result = await tool.execute({ mediaFolderPath });
      
      expect(result.error).toBeUndefined();
      expect(result.taskId).toBeDefined();
      expect(typeof result.taskId).toBe('string');
    });

    it('should handle Windows paths', async () => {
      const tool = createBeginRecognizeTaskTool(clientId);
      const mediaFolderPath = 'C:\\Users\\test\\media';
      
      const result = await tool.execute({ mediaFolderPath });
      
      expect(result.error).toBeUndefined();
      expect(result.taskId).toBeDefined();
    });

    it('should return error on abort', async () => {
      const abortController = new AbortController();
      abortController.abort();
      const tool = createBeginRecognizeTaskTool(clientId, abortController.signal);
      
      await expect(tool.execute({ mediaFolderPath: '/path/to/media' })).rejects.toThrow('Request was aborted');
    });
  });

  describe('createAddRecognizedMediaFileTool', () => {
    it('should have correct tool name and description', () => {
      const tool = createAddRecognizedMediaFileTool(clientId);
      
      expect(tool.toolName).toBe('addRecognizedMediaFile');
      expect(tool.description).toContain('Add a recognized media file');
    });

    it('should add a file to an existing task', async () => {
      const beginTool = createBeginRecognizeTaskTool(clientId);
      const addTool = createAddRecognizedMediaFileTool(clientId);
      
      const beginResult = await beginTool.execute({ mediaFolderPath: '/path/to/media' });
      const taskId = beginResult.taskId!;
      
      const addResult = await addTool.execute({
        taskId,
        season: 1,
        episode: 5,
        path: '/path/to/file.mp4',
      });
      
      expect(addResult.error).toBeUndefined();
    });

    it('should return error if task does not exist', async () => {
      const tool = createAddRecognizedMediaFileTool(clientId);
      
      const result = await tool.execute({
        taskId: 'non-existent-task-id',
        season: 1,
        episode: 1,
        path: '/path/to/file.mp4',
      });
      
      expect(result.error).toBeDefined();
      expect(result.error).toContain('not found');
    });

    it('should handle Windows paths', async () => {
      const beginTool = createBeginRecognizeTaskTool(clientId);
      const addTool = createAddRecognizedMediaFileTool(clientId);
      
      const beginResult = await beginTool.execute({ mediaFolderPath: '/path/to/media' });
      const taskId = beginResult.taskId!;
      
      const addResult = await addTool.execute({
        taskId,
        season: 1,
        episode: 1,
        path: 'C:\\Users\\test\\file.mp4',
      });
      
      expect(addResult.error).toBeUndefined();
    });

    it('should return error on abort', async () => {
      const abortController = new AbortController();
      abortController.abort();
      const tool = createAddRecognizedMediaFileTool(clientId, abortController.signal);
      
      await expect(tool.execute({
        taskId: 'test-task-id',
        season: 1,
        episode: 1,
        path: '/path/to/file.mp4',
      })).rejects.toThrow('Request was aborted');
    });
  });

  describe('createEndRecognizeTaskTool', () => {
    it('should have correct tool name and description', () => {
      const tool = createEndRecognizeTaskTool(clientId);
      
      expect(tool.toolName).toBe('endRecognizeTask');
      expect(tool.description).toContain('End a recognition task');
    });

    it('should end task and notify UI', async () => {
      const beginTool = createBeginRecognizeTaskTool(clientId);
      const addTool = createAddRecognizedMediaFileTool(clientId);
      const endTool = createEndRecognizeTaskTool(clientId);
      
      const beginResult = await beginTool.execute({ mediaFolderPath: '/path/to/media' });
      const taskId = beginResult.taskId!;
      
      await addTool.execute({
        taskId,
        season: 1,
        episode: 1,
        path: '/path/to/file1.mp4',
      });
      
      const endResult = await endTool.execute({ taskId });
      
      expect(endResult.error).toBeUndefined();
      expect(broadcastCalls.length).toBeGreaterThan(0);
    });

    it('should return error if task does not exist', async () => {
      const tool = createEndRecognizeTaskTool(clientId);
      
      const result = await tool.execute({ taskId: 'non-existent-task-id' });
      
      expect(result.error).toBeDefined();
      expect(result.error).toContain('not found');
    });

    it('should return error if task has no files', async () => {
      const beginTool = createBeginRecognizeTaskTool(clientId);
      const endTool = createEndRecognizeTaskTool(clientId);
      
      const beginResult = await beginTool.execute({ mediaFolderPath: '/path/to/media' });
      const taskId = beginResult.taskId!;
      
      const endResult = await endTool.execute({ taskId });
      
      expect(endResult.error).toBeDefined();
      expect(endResult.error).toContain('No recognized files');
    });

    it('should return error on abort', async () => {
      const abortController = new AbortController();
      abortController.abort();
      const tool = createEndRecognizeTaskTool(clientId, abortController.signal);
      
      await expect(tool.execute({ taskId: 'test-task-id' })).rejects.toThrow('Request was aborted');
    });
  });
});
