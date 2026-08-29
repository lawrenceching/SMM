import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

const mocks = vi.hoisted(() => ({
  createRenameEpisodePlan: vi.fn(),
  broadcast: vi.fn(),
}))

vi.mock('../../core/getCore', () => ({
  getCore: () => mocks,
}))

vi.mock('@/utils/socketIO', () => ({
  broadcast: mocks.broadcast,
}))

vi.mock('../../../lib/logger', () => ({
  logger: { error: vi.fn() },
}))

vi.mock('@/utils/config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/config')>()),
  getUserDataDir: () => '/smm-data',
}))

import { handleDebugCreateRenameEpisodePlan } from './debugCreateRenameEpisodePlan'

describe('POST /debug/createRenameEpisodePlan', () => {
  let app: Hono

  beforeEach(() => {
    mocks.createRenameEpisodePlan.mockReset()
    mocks.broadcast.mockReset()
    app = new Hono()
    handleDebugCreateRenameEpisodePlan(app)
  })

  it('returns the created plan and plan id', async () => {
    const plan = {
      id: 'plan-debug',
      task: 'rename-files',
      status: 'pending',
      creator: 'app',
      mediaFolderPath: '/media/Show',
      files: [{ from: '/media/Show/a.mkv', to: '/media/Show/S01E01.mkv' }],
    }
    mocks.createRenameEpisodePlan.mockResolvedValue(plan)

    const response = await app.request('/debug/createRenameEpisodePlan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mediaFolderPath: '/media/Show',
        files: plan.files,
        creator: 'app',
      }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { planId: 'plan-debug', plan },
    })
  })

  it('returns a debug error response when Core rejects the plan', async () => {
    mocks.createRenameEpisodePlan.mockRejectedValue(new Error('No rename entries in task'))

    const response = await app.request('/debug/createRenameEpisodePlan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaFolderPath: '/media/Show', files: [] }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Error Reason: No rename entries in task',
    })
  })

  it('does not double-prefix when Core throws a pre-prefixed error', async () => {
    mocks.createRenameEpisodePlan.mockRejectedValue(
      new Error('Error Reason: No rename entries in task'),
    )

    const response = await app.request('/debug/createRenameEpisodePlan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaFolderPath: '/media/Show', files: [] }),
    })

    expect(response.status).toBe(200)
    const json = (await response.json()) as { success: boolean; error: string }
    expect(json).toEqual({
      success: false,
      error: 'Error Reason: No rename entries in task',
    })
    expect(json.error.match(/Error Reason:/g)).toHaveLength(1)
  })
})
