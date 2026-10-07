import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
}))

vi.mock('../../tools/getEpisodes', () => ({
  getEpisodesAgentTool: vi.fn(() => ({ execute: mocks.execute })),
}))

vi.mock('../../../lib/logger', () => ({
  logger: { error: vi.fn() },
}))

import { debugGetEpisodesToolRoute } from './debugGetEpisodesTool'

describe('POST /debug/getEpisodesTool', () => {
  let app: Hono

  beforeEach(() => {
    mocks.execute.mockReset()
    app = debugGetEpisodesToolRoute
  })

  it('returns episodes for a media folder', async () => {
    mocks.execute.mockResolvedValue({ episodes: [] })

    const response = await app.request('/debug/getEpisodesTool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaFolderPath: '/media/Show' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { episodes: [] },
    })
  })

  it('reports tool errors in-band without the error field in data', async () => {
    mocks.execute.mockResolvedValue({ episodes: [], error: 'not a tvshow folder' })

    const response = await app.request('/debug/getEpisodesTool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaFolderPath: '/media/Show' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: false,
      data: { episodes: [] },
      error: 'not a tvshow folder',
    })
  })
})
