import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
}))

vi.mock('../../tools', () => ({
  agentTools: {
    getMediaMetadata: vi.fn(() => ({ execute: mocks.execute })),
  },
}))

vi.mock('../../../lib/logger', () => ({
  logger: { error: vi.fn() },
}))

import { debugGetMediaMetadataRoute } from './debugGetMediaMetadata'

describe('POST /debug/getMediaMetadata', () => {
  let app: Hono

  beforeEach(() => {
    mocks.execute.mockReset()
    app = debugGetMediaMetadataRoute
  })

  it('returns media metadata', async () => {
    mocks.execute.mockResolvedValue({ mediaFolderPath: '/media/Show', type: 'tvshow-folder' })

    const response = await app.request('/debug/getMediaMetadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaFolderPath: '/media/Show' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { mediaFolderPath: '/media/Show', type: 'tvshow-folder' },
    })
  })

  it('reports tool errors in-band without the error field in data', async () => {
    mocks.execute.mockResolvedValue({ mediaFolderPath: '/media/Show', error: 'not found' })

    const response = await app.request('/debug/getMediaMetadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaFolderPath: '/media/Show' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: false,
      data: { mediaFolderPath: '/media/Show' },
      error: 'not found',
    })
  })
})
