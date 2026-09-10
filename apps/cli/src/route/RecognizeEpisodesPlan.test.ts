import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

const mocks = vi.hoisted(() => ({
  createRecognizeEpisodePlan: vi.fn(),
  broadcast: vi.fn(),
}))

vi.mock('../core/getCore', () => ({
  getCore: () => mocks,
}))

vi.mock('@/utils/socketIO', () => ({
  broadcast: mocks.broadcast,
}))

vi.mock('@/utils/config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/config')>()),
  getAppDataDir: () => 'C:/smm-app-data',
}))

import { handleRecognizeEpisodesPlan } from './RecognizeEpisodesPlan'

const plan = {
  id: 'plan-1',
  task: 'recognize-media-file' as const,
  status: 'pending' as const,
  creator: 'ai' as const,
  mediaFolderPath: '/media/Show',
  files: [{ season: 1, episode: 1, path: '/media/Show/S01E01.mkv' }],
}

describe('POST /api/create-recognize-episode-plan', () => {
  let app: Hono

  beforeEach(() => {
    mocks.createRecognizeEpisodePlan.mockReset()
    mocks.broadcast.mockReset()
    app = new Hono()
    handleRecognizeEpisodesPlan(app)
  })

  async function post(body: unknown) {
    return app.request('/api/create-recognize-episode-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('creates an AI plan through Core and broadcasts it', async () => {
    mocks.createRecognizeEpisodePlan.mockResolvedValue(plan)

    const response = await post({
      mediaFolderPath: '/media/Show',
      files: plan.files,
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: { plan } })
    expect(mocks.createRecognizeEpisodePlan).toHaveBeenCalledWith(
      '/media/Show',
      plan.files,
      { creator: 'ai' },
    )
    expect(mocks.broadcast).toHaveBeenCalledWith({
      event: 'recognizeMediaFilePlanReady',
      data: {
        taskId: 'plan-1',
        planFilePath: '/C:/smm-app-data/plans/plan-1.plan.json',
      },
    })
  })

  it('creates an app plan without broadcasting it', async () => {
    mocks.createRecognizeEpisodePlan.mockResolvedValue({ ...plan, creator: 'app' })

    const response = await post({
      mediaFolderPath: '/media/Show',
      files: plan.files,
      creator: 'app',
    })

    expect(response.status).toBe(200)
    expect(mocks.createRecognizeEpisodePlan).toHaveBeenCalledWith(
      '/media/Show',
      plan.files,
      { creator: 'app' },
    )
    expect(mocks.broadcast).not.toHaveBeenCalled()
  })

  it('returns an Error Reason when mediaFolderPath is missing', async () => {
    const response = await post({ files: plan.files })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      error: 'Error Reason: mediaFolderPath is required',
    })
    expect(mocks.createRecognizeEpisodePlan).not.toHaveBeenCalled()
    expect(mocks.broadcast).not.toHaveBeenCalled()
  })

  it('returns an Error Reason for invalid files', async () => {
    const response = await post({ mediaFolderPath: '/media/Show', files: 'invalid' })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      error: 'Error Reason: files must be an array',
    })
    expect(mocks.createRecognizeEpisodePlan).not.toHaveBeenCalled()
    expect(mocks.broadcast).not.toHaveBeenCalled()
  })
})
