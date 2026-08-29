import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

const mocks = vi.hoisted(() => ({
  createRenameEpisodePlan: vi.fn(),
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
  getUserDataDir: () => 'C:/smm-data',
}))

import { handleRenameEpisodesPlan } from './RenameEpisodesPlan'

const plan = {
  id: 'plan-1',
  task: 'rename-files' as const,
  status: 'pending' as const,
  creator: 'ai' as const,
  mediaFolderPath: '/media/Show',
  files: [{ from: '/media/Show/old.mkv', to: '/media/Show/S01E01.mkv' }],
}

describe('POST /api/create-rename-episode-plan', () => {
  let app: Hono

  beforeEach(() => {
    mocks.createRenameEpisodePlan.mockReset()
    mocks.broadcast.mockReset()
    app = new Hono()
    handleRenameEpisodesPlan(app)
  })

  async function post(body: unknown) {
    return app.request('/api/create-rename-episode-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('creates an AI plan through Core and broadcasts it', async () => {
    mocks.createRenameEpisodePlan.mockResolvedValue(plan)

    const response = await post({
      mediaFolderPath: '/media/Show',
      files: plan.files,
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: { plan } })
    expect(mocks.createRenameEpisodePlan).toHaveBeenCalledWith(
      '/media/Show',
      plan.files,
      { creator: 'ai' },
    )
    expect(mocks.broadcast).toHaveBeenCalledWith({
      event: 'renameFilesPlanReady',
      data: {
        taskId: 'plan-1',
        planFilePath: '/C:/smm-data/plans/plan-1.plan.json',
      },
    })
  })

  it('creates an app plan without broadcasting it', async () => {
    mocks.createRenameEpisodePlan.mockResolvedValue({ ...plan, creator: 'app' })

    const response = await post({
      mediaFolderPath: '/media/Show',
      files: plan.files,
      creator: 'app',
    })

    expect(response.status).toBe(200)
    expect(mocks.createRenameEpisodePlan).toHaveBeenCalledWith(
      '/media/Show',
      plan.files,
      { creator: 'app' },
    )
    expect(mocks.broadcast).not.toHaveBeenCalled()
  })

  it('returns an Error Reason for invalid input', async () => {
    const response = await post({ mediaFolderPath: '/media/Show', files: 'invalid' })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      error: 'Error Reason: files must be an array',
    })
    expect(mocks.createRenameEpisodePlan).not.toHaveBeenCalled()
  })

  it('does not double-prefix when Core throws a pre-prefixed error', async () => {
    mocks.createRenameEpisodePlan.mockRejectedValue(
      new Error('Error Reason: No rename entries in task'),
    )

    const response = await post({
      mediaFolderPath: '/media/Show',
      files: [],
    })

    expect(response.status).toBe(200)
    const json = (await response.json()) as { error: string }
    expect(json.error).toBe('Error Reason: No rename entries in task')
    expect(json.error.match(/Error Reason:/g)).toHaveLength(1)
  })
})
