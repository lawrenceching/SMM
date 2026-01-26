import { describe, it, expect, beforeEach, afterEach, afterAll, mock } from 'bun:test'
import { tmpdir } from 'os'
import { join } from 'path'
import { rm, mkdir } from 'fs/promises'

import * as configModule from '@/utils/config'
import * as socketIOModule from '../utils/socketIO'

const realConfigModule = { ...configModule }
const realSocketIOModule = { ...socketIOModule }

let currentMockUserDataDir: string
let broadcastCalls: Array<{ event: string; data: unknown }> = []

mock.module('@/utils/config', () => ({
  getUserDataDir: () => currentMockUserDataDir,
  getUserConfig: async () => ({ folders: [] }),
  getLogDir: () => join(currentMockUserDataDir, 'logs'),
  getUserConfigPath: () => join(currentMockUserDataDir, 'smm.json'),
  writeUserConfig: async () => {},
}))

mock.module('../utils/socketIO', () => ({
  ...realSocketIOModule,
  broadcast: (message: { event: string; data: unknown }) => {
    broadcastCalls.push(message)
  },
}))

mock.module('../route/mediaMetadata/utils', () => ({
  metadataCacheFilePath: () => join(currentMockUserDataDir, 'meta.json'),
}))

const {
  createBeginRenameFilesTaskV2Tool,
  createAddRenameFileToTaskV2Tool,
  createEndRenameFilesTaskV2Tool,
} = await import('./renameFilesTaskV2')

const clientId = 'test-client-id'

describe('renameFilesTaskV2', () => {
  let testUserDataDir: string

  beforeEach(async () => {
    testUserDataDir = join(
      tmpdir(),
      `smm-rename-task-v2-test-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    )
    currentMockUserDataDir = testUserDataDir
    broadcastCalls = []
    await mkdir(testUserDataDir, { recursive: true })
    await Bun.write(join(testUserDataDir, 'meta.json'), '{}')
  })

  afterEach(async () => {
    try {
      await rm(testUserDataDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
    broadcastCalls = []
  })

  afterAll(() => {
    mock.restore()
    mock.module('@/utils/config', () => ({ ...realConfigModule }))
    mock.module('../utils/socketIO', () => ({ ...realSocketIOModule }))
  })

  describe('createBeginRenameFilesTaskV2Tool', () => {
    it('should have correct tool name and description', () => {
      const tool = createBeginRenameFilesTaskV2Tool(clientId)
      expect(tool.toolName).toBe('beginRenameFilesTaskV2')
      expect(tool.description).toContain('Begin a rename files task V2')
    })

    it('should create a task and return task ID', async () => {
      const tool = createBeginRenameFilesTaskV2Tool(clientId)
      const mediaFolderPath = '/path/to/media/folder'
      const result = await tool.execute({ mediaFolderPath })
      expect(result.error).toBeUndefined()
      expect(result.taskId).toBeDefined()
      expect(typeof result.taskId).toBe('string')
    })

    it('should handle Windows paths', async () => {
      const tool = createBeginRenameFilesTaskV2Tool(clientId)
      const mediaFolderPath = 'C:\\Users\\test\\media'
      const result = await tool.execute({ mediaFolderPath })
      expect(result.error).toBeUndefined()
      expect(result.taskId).toBeDefined()
    })

    it('should return error when metadata does not exist', async () => {
      const tool = createBeginRenameFilesTaskV2Tool(clientId)
      await rm(join(testUserDataDir, 'meta.json'), { force: true })
      const result = await tool.execute({ mediaFolderPath: '/path/to/media' })
      expect(result.error).toBeDefined()
      expect(result.error).toContain('not opened in SMM')
    })

    it('should return error on abort', async () => {
      const abortController = new AbortController()
      abortController.abort()
      const tool = createBeginRenameFilesTaskV2Tool(clientId, abortController.signal)
      await expect(tool.execute({ mediaFolderPath: '/path/to/media' })).rejects.toThrow(
        'Request was aborted'
      )
    })
  })

  describe('createAddRenameFileToTaskV2Tool', () => {
    it('should have correct tool name and description', () => {
      const tool = createAddRenameFileToTaskV2Tool(clientId)
      expect(tool.toolName).toBe('addRenameFileToTaskV2')
      expect(tool.description).toContain('Add a file rename')
    })

    it('should add a file to an existing task', async () => {
      const beginTool = createBeginRenameFilesTaskV2Tool(clientId)
      const addTool = createAddRenameFileToTaskV2Tool(clientId)
      const beginResult = await beginTool.execute({ mediaFolderPath: '/path/to/media' })
      const taskId = beginResult.taskId!
      const addResult = await addTool.execute({
        taskId,
        from: '/path/to/old.mp4',
        to: '/path/to/new.mp4',
      })
      expect(addResult.error).toBeUndefined()
    })

    it('should return error if task does not exist', async () => {
      const tool = createAddRenameFileToTaskV2Tool(clientId)
      const result = await tool.execute({
        taskId: 'non-existent-task-id',
        from: '/path/to/a.mp4',
        to: '/path/to/b.mp4',
      })
      expect(result.error).toBeDefined()
      expect(result.error).toContain('not found')
    })

    it('should handle Windows paths', async () => {
      const beginTool = createBeginRenameFilesTaskV2Tool(clientId)
      const addTool = createAddRenameFileToTaskV2Tool(clientId)
      const beginResult = await beginTool.execute({ mediaFolderPath: '/path/to/media' })
      const taskId = beginResult.taskId!
      const addResult = await addTool.execute({
        taskId,
        from: 'C:\\Users\\test\\old.mp4',
        to: 'C:\\Users\\test\\new.mp4',
      })
      expect(addResult.error).toBeUndefined()
    })

    it('should return error on abort', async () => {
      const abortController = new AbortController()
      abortController.abort()
      const tool = createAddRenameFileToTaskV2Tool(clientId, abortController.signal)
      await expect(
        tool.execute({
          taskId: 'test-task-id',
          from: '/path/to/a.mp4',
          to: '/path/to/b.mp4',
        })
      ).rejects.toThrow('Request was aborted')
    })
  })

  describe('createEndRenameFilesTaskV2Tool', () => {
    it('should have correct tool name and description', () => {
      const tool = createEndRenameFilesTaskV2Tool(clientId)
      expect(tool.toolName).toBe('endRenameFilesTaskV2')
      expect(tool.description).toContain('End a rename task V2')
    })

    it('should end task and notify UI', async () => {
      const beginTool = createBeginRenameFilesTaskV2Tool(clientId)
      const addTool = createAddRenameFileToTaskV2Tool(clientId)
      const endTool = createEndRenameFilesTaskV2Tool(clientId)
      const beginResult = await beginTool.execute({ mediaFolderPath: '/path/to/media' })
      const taskId = beginResult.taskId!
      await addTool.execute({
        taskId,
        from: '/path/to/file1.mp4',
        to: '/path/to/renamed.mp4',
      })
      const endResult = await endTool.execute({ taskId })
      expect(endResult.error).toBeUndefined()
      expect(broadcastCalls.length).toBeGreaterThan(0)
    })

    it('should return error if task does not exist', async () => {
      const tool = createEndRenameFilesTaskV2Tool(clientId)
      const result = await tool.execute({ taskId: 'non-existent-task-id' })
      expect(result.error).toBeDefined()
      expect(result.error).toContain('not found')
    })

    it('should return error if task has no files', async () => {
      const beginTool = createBeginRenameFilesTaskV2Tool(clientId)
      const endTool = createEndRenameFilesTaskV2Tool(clientId)
      const beginResult = await beginTool.execute({ mediaFolderPath: '/path/to/media' })
      const taskId = beginResult.taskId!
      const endResult = await endTool.execute({ taskId })
      expect(endResult.error).toBeDefined()
      expect(endResult.error).toContain('No rename entries')
    })

    it('should return error on abort', async () => {
      const abortController = new AbortController()
      abortController.abort()
      const tool = createEndRenameFilesTaskV2Tool(clientId, abortController.signal)
      await expect(tool.execute({ taskId: 'test-task-id' })).rejects.toThrow(
        'Request was aborted'
      )
    })
  })
})
