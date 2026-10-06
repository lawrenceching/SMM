import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

const mocks = vi.hoisted(() => ({
  recognizeFolder: vi.fn(),
}))

vi.mock('../core/getCore', () => ({
  getCore: () => mocks,
}))

import { handleRecognizeFolder } from './RecognizeFolder'

describe('RecognizeFolder HTTP API', () => {
  let app: Hono

  beforeEach(() => {
    mocks.recognizeFolder.mockReset()
    app = new Hono()
    handleRecognizeFolder(app)
  })

  async function post(body: unknown) {
    return app.request('/api/recognize-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('returns Error Reason when path is missing', async () => {
    const res = await post({ db: 'tmdb', id: '84666' })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { error?: string }
    expect(json.error).toMatch(/^Error Reason: path is required/)
    expect(mocks.recognizeFolder).not.toHaveBeenCalled()
  })

  it('returns Error Reason when db is invalid', async () => {
    const res = await post({ path: '/m/Show', db: 'imdb', id: '84666' })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { error?: string }
    expect(json.error).toMatch(/^Error Reason: db must be tmdb or tvdb/)
    expect(mocks.recognizeFolder).not.toHaveBeenCalled()
  })

  it('returns Error Reason when id is missing', async () => {
    const res = await post({ path: '/m/Show', db: 'tmdb' })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { error?: string }
    expect(json.error).toMatch(/^Error Reason: id is required/)
    expect(mocks.recognizeFolder).not.toHaveBeenCalled()
  })

  it('calls Core.recognizeFolder and returns data', async () => {
    mocks.recognizeFolder.mockResolvedValue(undefined)
    const res = await post({ path: '/m/Show', db: 'tmdb', id: '84666' })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { data?: { path: string }; error?: string }
    expect(json.error).toBeUndefined()
    expect(json.data).toEqual({ path: '/m/Show' })
    expect(mocks.recognizeFolder).toHaveBeenCalledWith('/m/Show', { db: 'tmdb', id: '84666' })
  })

  it('maps Core errors to Error Reason', async () => {
    mocks.recognizeFolder.mockRejectedValue(new Error('/m/Show is not managed by SMM'))
    const res = await post({ path: '/m/Show', db: 'tvdb', id: '421069' })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { error?: string }
    expect(json.error).toBe('Error Reason: /m/Show is not managed by SMM')
  })
})
