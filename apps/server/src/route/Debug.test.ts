import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

const mocks = vi.hoisted(() => ({
  broadcast: vi.fn(),
  acknowledge: vi.fn(),
}))

vi.mock('../utils/socketIO', () => ({
  broadcast: mocks.broadcast,
  acknowledge: mocks.acknowledge,
}))

vi.mock('../../lib/logger', () => ({
  logger: { error: vi.fn() },
}))

vi.mock('../utils/config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../utils/config')>()),
  getUserDataDir: () => '/smm-data',
}))

vi.mock('../route/mediaMetadata/utils', () => ({
  mediaMetadataDir: '/smm-data/media-metadata',
}))

import { debugRoute } from './Debug'

describe('POST /debug', () => {
  let app: Hono

  beforeEach(() => {
    mocks.broadcast.mockReset()
    mocks.acknowledge.mockReset()
    app = debugRoute
  })

  it('broadcasts a message and reports success', async () => {
    const response = await app.request('/debug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'broadcastMessage', event: 'debug-event', data: { x: 1 } }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(mocks.broadcast).toHaveBeenCalledWith({ event: 'debug-event', data: { x: 1 } })
  })

  it('returns a validation error for unknown debug functions', async () => {
    const response = await app.request('/debug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'nope' }),
    })

    expect(response.status).toBe(200)
    const json = (await response.json()) as { success: boolean; error: string }
    expect(json.success).toBe(false)
    expect(json.error).toMatch(/^Validation failed:/)
  })
})
