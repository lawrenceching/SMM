import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

const mocks = vi.hoisted(() => ({
  executeRenameFolder: vi.fn(),
}))

vi.mock('../../tools/renameFolder', () => ({
  executeRenameFolder: mocks.executeRenameFolder,
}))

vi.mock('../../../lib/logger', () => ({
  logger: { error: vi.fn() },
}))

import { debugRenameFolderToolRoute } from './debugRenameFolderTool'

describe('POST /debug/renameFolderTool', () => {
  let app: Hono

  beforeEach(() => {
    mocks.executeRenameFolder.mockReset()
    app = debugRenameFolderToolRoute
  })

  it('renames a folder', async () => {
    mocks.executeRenameFolder.mockResolvedValue({ renamed: true })

    const response = await app.request('/debug/renameFolderTool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: '/media/Old', to: '/media/New' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { renamed: true },
    })
  })

  it('reports rename failures in-band', async () => {
    mocks.executeRenameFolder.mockResolvedValue({ renamed: false, error: 'target exists' })

    const response = await app.request('/debug/renameFolderTool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: '/media/Old', to: '/media/New' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: false,
      data: { renamed: false, error: 'target exists' },
      error: 'target exists',
    })
  })
})
