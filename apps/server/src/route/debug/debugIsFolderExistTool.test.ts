import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
}))

vi.mock('../../tools', () => ({
  agentTools: {
    isFolderExist: vi.fn(() => ({ execute: mocks.execute })),
  },
}))

vi.mock('../../../lib/logger', () => ({
  logger: { error: vi.fn() },
}))

import { debugIsFolderExistToolRoute } from './debugIsFolderExistTool'

describe('POST /debug/isFolderExistTool', () => {
  let app: Hono

  beforeEach(() => {
    mocks.execute.mockReset()
    app = debugIsFolderExistToolRoute
  })

  it('returns folder existence', async () => {
    mocks.execute.mockResolvedValue({ exists: true })

    const response = await app.request('/debug/isFolderExistTool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/media/Show' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { exists: true },
    })
  })

  it('reports execution failures as in-band errors', async () => {
    mocks.execute.mockRejectedValue(new Error('boom'))

    const response = await app.request('/debug/isFolderExistTool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/media/Show' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Failed to execute isFolderExist tool: boom',
    })
  })
})
