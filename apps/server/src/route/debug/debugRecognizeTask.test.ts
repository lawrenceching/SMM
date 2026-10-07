import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

const mocks = vi.hoisted(() => ({
  beginExecute: vi.fn(),
  addExecute: vi.fn(),
  endExecute: vi.fn(),
}))

vi.mock('../../tools/recognizeMediaFilesTask', () => ({
  createBeginRecognizeTaskTool: vi.fn(() => ({ execute: mocks.beginExecute })),
  createAddRecognizedMediaFileTool: vi.fn(() => ({ execute: mocks.addExecute })),
  createEndRecognizeTaskTool: vi.fn(() => ({ execute: mocks.endExecute })),
}))

vi.mock('../../../lib/logger', () => ({
  logger: { error: vi.fn() },
}))

import { debugRecognizeTaskRoute } from './debugRecognizeTask'

describe('POST /debug/startRecognizeTask', () => {
  let app: Hono

  beforeEach(() => {
    mocks.beginExecute.mockReset()
    mocks.addExecute.mockReset()
    mocks.endExecute.mockReset()
    app = debugRecognizeTaskRoute
  })

  it('starts a recognize task', async () => {
    mocks.beginExecute.mockResolvedValue({ taskId: 'task-1' })

    const response = await app.request('/debug/startRecognizeTask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaFolderPath: '/media/Show' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { taskId: 'task-1' },
    })
    expect(mocks.beginExecute).toHaveBeenCalledWith({ mediaFolderPath: '/media/Show' })
  })

  it('reports tool errors in-band with data', async () => {
    mocks.beginExecute.mockResolvedValue({ taskId: undefined, error: 'x' })

    const response = await app.request('/debug/startRecognizeTask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaFolderPath: '/media/Show' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: false,
      data: { error: 'x' },
      error: 'x',
    })
  })

  it('reports validation failures', async () => {
    const response = await app.request('/debug/startRecognizeTask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(response.status).toBe(200)
    const json = (await response.json()) as { success: boolean; error: string }
    expect(json.success).toBe(false)
    expect(json.error).toMatch(/^Validation failed:/)
  })
})

describe('POST /debug/addFileToRecognizeTask', () => {
  let app: Hono

  beforeEach(() => {
    mocks.beginExecute.mockReset()
    mocks.addExecute.mockReset()
    mocks.endExecute.mockReset()
    app = debugRecognizeTaskRoute
  })

  it('adds a file to a recognize task', async () => {
    mocks.addExecute.mockResolvedValue({})

    const response = await app.request('/debug/addFileToRecognizeTask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId: 'task-1',
        season: 1,
        episode: 2,
        path: '/media/Show/a.mkv',
      }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true, data: {} })
    expect(mocks.addExecute).toHaveBeenCalledWith({
      taskId: 'task-1',
      season: 1,
      episode: 2,
      path: '/media/Show/a.mkv',
    })
  })

  it('reports validation failures', async () => {
    const response = await app.request('/debug/addFileToRecognizeTask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: 'task-1', season: -1, episode: 0, path: '/a.mkv' }),
    })

    expect(response.status).toBe(200)
    const json = (await response.json()) as { success: boolean; error: string }
    expect(json.success).toBe(false)
    expect(json.error).toMatch(/^Validation failed:/)
  })
})

describe('POST /debug/endRecognizeTask', () => {
  let app: Hono

  beforeEach(() => {
    mocks.beginExecute.mockReset()
    mocks.addExecute.mockReset()
    mocks.endExecute.mockReset()
    app = debugRecognizeTaskRoute
  })

  it('ends a recognize task', async () => {
    mocks.endExecute.mockResolvedValue({})

    const response = await app.request('/debug/endRecognizeTask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: 'task-1' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true, data: {} })
    expect(mocks.endExecute).toHaveBeenCalledWith({ taskId: 'task-1' })
  })

  it('reports validation failures', async () => {
    const response = await app.request('/debug/endRecognizeTask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(response.status).toBe(200)
    const json = (await response.json()) as { success: boolean; error: string }
    expect(json.success).toBe(false)
    expect(json.error).toMatch(/^Validation failed:/)
  })
})
