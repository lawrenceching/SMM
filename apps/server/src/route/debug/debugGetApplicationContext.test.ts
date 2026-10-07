import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
}))

vi.mock('../../tools', () => ({
  agentTools: {
    getApplicationContext: vi.fn(() => ({ execute: mocks.execute })),
  },
}))

vi.mock('../../../lib/logger', () => ({
  logger: { error: vi.fn() },
}))

import { debugGetApplicationContextRoute } from './debugGetApplicationContext'

describe('POST /debug/getApplicationContext', () => {
  let app: Hono

  beforeEach(() => {
    mocks.execute.mockReset()
    app = debugGetApplicationContextRoute
  })

  it('returns the application context', async () => {
    mocks.execute.mockResolvedValue({ selectedMediaFolder: '/media/Show', language: 'en' })

    const response = await app.request('/debug/getApplicationContext', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { selectedMediaFolder: '/media/Show', language: 'en' },
    })
  })

  it('reports tool errors in-band', async () => {
    mocks.execute.mockResolvedValue({ error: 'no media folder selected' })

    const response = await app.request('/debug/getApplicationContext', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'no media folder selected',
    })
  })
})
