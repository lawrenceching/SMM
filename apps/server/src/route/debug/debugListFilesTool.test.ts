import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
}))

vi.mock('../../tools/listFilesInMediaFolder', () => ({
  listFilesInMediaFolderAgentTool: vi.fn(() => ({ execute: mocks.execute })),
}))

vi.mock('../../../lib/logger', () => ({
  logger: { error: vi.fn() },
}))

import { debugListFilesToolRoute } from './debugListFilesTool'

describe('POST /debug/listFilesTool', () => {
  let app: Hono

  beforeEach(() => {
    mocks.execute.mockReset()
    app = debugListFilesToolRoute
  })

  it('lists files in a media folder', async () => {
    mocks.execute.mockResolvedValue({ files: ['a.mkv'] })

    const response = await app.request('/debug/listFilesTool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaFolderPath: '/media/Show' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { files: ['a.mkv'] },
    })
  })

  it('reports tool errors in-band without the error field in data', async () => {
    mocks.execute.mockResolvedValue({ files: [], error: 'folder missing' })

    const response = await app.request('/debug/listFilesTool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaFolderPath: '/media/Show' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: false,
      data: { files: [] },
      error: 'folder missing',
    })
  })
})
