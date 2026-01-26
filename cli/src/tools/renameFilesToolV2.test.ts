import { describe, it, expect, beforeEach, afterEach, afterAll, mock } from 'bun:test'
import { tmpdir } from 'os'
import { join } from 'path'
import { rm } from 'fs/promises'

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

const {
  beginRenameFilesTaskV2,
  addRenameFileToTaskV2,
  getRenameTask,
  endRenameFilesTaskV2,
  getAllPendingRenamePlans,
  updateRenamePlanStatus,
  getRenamePlanByPlanId,
} = await import('./renameFilesToolV2')
import { RenameFilesPlanReady } from '@core/event-types'

describe('renameFilesToolV2', () => {
  let testUserDataDir: string

  beforeEach(async () => {
    testUserDataDir = join(
      tmpdir(),
      `smm-rename-v2-test-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    )
    currentMockUserDataDir = testUserDataDir
    broadcastCalls = []
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

  describe('beginRenameFilesTaskV2', () => {
    it('creates a new task and returns task ID', async () => {
      const mediaFolderPath = '/path/to/media/folder'
      const taskId = await beginRenameFilesTaskV2(mediaFolderPath)
      expect(taskId).toBeDefined()
      expect(typeof taskId).toBe('string')
      const task = await getRenameTask(taskId)
      expect(task).toBeDefined()
      expect(task?.task).toBe('rename-files')
      expect(task?.mediaFolderPath).toBe('/path/to/media/folder')
      expect(task?.files).toEqual([])
      expect(task?.status).toBe('pending')
    })
  })

  describe('addRenameFileToTaskV2', () => {
    it('adds a rename entry to an existing task', async () => {
      const taskId = await beginRenameFilesTaskV2('/path/to/media')
      await addRenameFileToTaskV2(taskId, '/path/to/old.mp4', '/path/to/new.mp4')
      const task = await getRenameTask(taskId)
      expect(task?.files).toHaveLength(1)
      expect(task?.files[0]).toEqual({ from: '/path/to/old.mp4', to: '/path/to/new.mp4' })
    })

    it('throws if task does not exist', async () => {
      await expect(
        addRenameFileToTaskV2('non-existent', '/a', '/b')
      ).rejects.toThrow('Task with id non-existent not found')
    })
  })

  describe('endRenameFilesTaskV2', () => {
    it('broadcasts RenameFilesPlanReady', async () => {
      const taskId = await beginRenameFilesTaskV2('/path/to/media')
      await addRenameFileToTaskV2(taskId, '/path/to/a.mp4', '/path/to/b.mp4')
      await endRenameFilesTaskV2(taskId)
      expect(broadcastCalls).toHaveLength(1)
      expect(broadcastCalls[0]?.event).toBe(RenameFilesPlanReady.event)
      expect(broadcastCalls[0]?.data).toBeDefined()
      expect((broadcastCalls[0]?.data as { taskId: string }).taskId).toBe(taskId)
    })

    it('throws if task does not exist', async () => {
      await expect(endRenameFilesTaskV2('non-existent')).rejects.toThrow(
        'Task with id non-existent not found'
      )
    })
  })

  describe('getAllPendingRenamePlans', () => {
    it('returns only pending rename plans', async () => {
      const taskId = await beginRenameFilesTaskV2('/path/to/media')
      await addRenameFileToTaskV2(taskId, '/a', '/b')
      const pending = await getAllPendingRenamePlans()
      expect(pending.length).toBeGreaterThanOrEqual(1)
      const plan = pending.find((p) => p.mediaFolderPath === '/path/to/media')
      expect(plan?.task).toBe('rename-files')
      expect(plan?.status).toBe('pending')
    })
  })

  describe('getRenamePlanByPlanId', () => {
    it('returns plan when id matches', async () => {
      const taskId = await beginRenameFilesTaskV2('/path/to/media')
      const task = await getRenameTask(taskId)
      expect(task).toBeDefined()
      const planId = task!.id
      const found = await getRenamePlanByPlanId(planId)
      expect(found).not.toBeNull()
      expect(found?.id).toBe(planId)
      expect(found?.task).toBe('rename-files')
    })

    it('returns null when plan id not found', async () => {
      const found = await getRenamePlanByPlanId('00000000-0000-0000-0000-000000000000')
      expect(found).toBeNull()
    })
  })

  describe('updateRenamePlanStatus', () => {
    it('updates status to rejected', async () => {
      const taskId = await beginRenameFilesTaskV2('/path/to/media')
      const task = await getRenameTask(taskId)
      expect(task).toBeDefined()
      await updateRenamePlanStatus(task!.id, 'rejected')
      const pending = await getAllPendingRenamePlans()
      const stillPending = pending.find((p) => p.id === task!.id)
      expect(stillPending).toBeUndefined()
    })

    it('throws if plan id not found', async () => {
      await beginRenameFilesTaskV2('/path/to/media') // ensure plans dir exists
      await expect(
        updateRenamePlanStatus('00000000-0000-0000-0000-000000000000', 'rejected')
      ).rejects.toThrow('not found')
    })
  })
})
