import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

const mocks = vi.hoisted(() => ({
  tryToRecognizeEpisodes: vi.fn(),
}))

vi.mock('../core/getCore', () => ({
  getCore: () => mocks,
}))

import { handleTryToRecognizeEpisodes } from './TryToRecognizeEpisodes'

const plan = {
  id: 'plan-r1',
  task: 'recognize-media-file' as const,
  status: 'pending' as const,
  creator: 'app' as const,
  mediaFolderPath: '/media/Show',
  files: [{ season: 1, episode: 1, path: '/media/Show/S01E01.mkv' }],
}

describe('POST /api/try-to-recognize-episodes', () => {
  let app: Hono

  beforeEach(() => {
    mocks.tryToRecognizeEpisodes.mockReset()
    app = new Hono()
    handleTryToRecognizeEpisodes(app)
  })

  async function post(body: unknown) {
    return app.request('/api/try-to-recognize-episodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('returns the pending plan', async () => {
    mocks.tryToRecognizeEpisodes.mockResolvedValue(plan)

    const response = await post({ mediaFolderPath: '/media/Show' })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: { plan } })
    expect(mocks.tryToRecognizeEpisodes).toHaveBeenCalledWith('/media/Show')
  })

  it('requires mediaFolderPath', async () => {
    const response = await post({})
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      error: 'Error Reason: mediaFolderPath is required',
    })
    expect(mocks.tryToRecognizeEpisodes).not.toHaveBeenCalled()
  })

  it('maps pipeline errors to Error Reason', async () => {
    mocks.tryToRecognizeEpisodes.mockRejectedValue(
      new Error('Media metadata not found: /media/Show'),
    )

    const response = await post({ mediaFolderPath: '/media/Show' })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      error: 'Error Reason: Media metadata not found: /media/Show',
    })
  })
})
