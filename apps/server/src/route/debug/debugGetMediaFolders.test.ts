import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
}))

vi.mock('../../tools/getMediaFolders', () => ({
  getMediaFoldersAgentTool: vi.fn(() => ({ execute: mocks.execute })),
}))

vi.mock('../../../lib/logger', () => ({
  logger: { error: vi.fn() },
}))

import { debugGetMediaFoldersRoute } from './debugGetMediaFolders'

describe('POST /debug/getMediaFolders', () => {
  let app: Hono

  beforeEach(() => {
    mocks.execute.mockReset()
    app = debugGetMediaFoldersRoute
  })

  it('returns media folders', async () => {
    mocks.execute.mockResolvedValue({ folders: ['/media/Show'] })

    const response = await app.request('/debug/getMediaFolders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { folders: ['/media/Show'] },
    })
  })

  it('reports tool errors in-band without the error field in data', async () => {
    mocks.execute.mockResolvedValue({ folders: [], error: 'config missing' })

    const response = await app.request('/debug/getMediaFolders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: false,
      data: { folders: [] },
      error: 'config missing',
    })
  })
})
