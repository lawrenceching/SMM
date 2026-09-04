import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

import { SelectedFilesNotInPlanError } from '@smm/core/pipeline/applySelectedRenameFilesPlan'

const mocks = vi.hoisted(() => ({
  createRenameEpisodePlan: vi.fn(),
  getPlan: vi.fn(),
  applyPlan: vi.fn(),
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
    mocks.getPlan.mockReset()
    mocks.applyPlan.mockReset()
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
        planFilePath: '/C:/smm-app-data/plans/plan-1.plan.json',
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

describe('POST /api/apply-plan', () => {
  let app: Hono

  beforeEach(() => {
    mocks.getPlan.mockReset()
    mocks.applyPlan.mockReset()
    app = new Hono()
    handleRenameEpisodesPlan(app)
  })

  async function post(body: unknown) {
    return app.request('/api/apply-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('applies with selected files when data.files is given', async () => {
    mocks.getPlan.mockResolvedValue(plan)
    mocks.applyPlan.mockResolvedValue(undefined)

    const response = await post({
      id: 'plan-1',
      data: { files: ['/media/Show/old.mkv'] },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: { id: 'plan-1' } })
    expect(mocks.getPlan).toHaveBeenCalledWith('plan-1')
    expect(mocks.applyPlan).toHaveBeenCalledWith(plan, {
      files: ['/media/Show/old.mkv'],
    })
    expect(mocks.broadcast).toHaveBeenCalledWith({
      clientId: undefined,
      event: 'mediaMetadataUpdated',
      data: { folderPath: '/media/Show' },
    })
  })

  it('applies with undefined data when data is absent', async () => {
    mocks.getPlan.mockResolvedValue(plan)
    mocks.applyPlan.mockResolvedValue(undefined)

    const response = await post({ id: 'plan-1' })

    expect(response.status).toBe(200)
    expect(mocks.applyPlan).toHaveBeenCalledWith(plan, undefined)
  })

  it('returns 400 ProblemDetails for malformed data.files', async () => {
    const response = await post({ id: 'plan-1', data: { files: [] } })

    expect(response.status).toBe(400)
    expect(response.headers.get('Content-Type')).toContain('application/problem+json')
    await expect(response.json()).resolves.toEqual({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: 'data.files must be a non-empty array of strings',
      instance: '/api/apply-plan',
    })
    expect(mocks.getPlan).not.toHaveBeenCalled()
  })

  it('returns 400 ProblemDetails when Core reports files not in plan', async () => {
    mocks.getPlan.mockResolvedValue(plan)
    mocks.applyPlan.mockRejectedValue(
      new SelectedFilesNotInPlanError(['/media/Show/nope.mkv']),
    )

    const response = await post({
      id: 'plan-1',
      data: { files: ['/media/Show/nope.mkv'] },
    })

    expect(response.status).toBe(400)
    expect(response.headers.get('Content-Type')).toContain('application/problem+json')
    await expect(response.json()).resolves.toEqual({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: 'Files not in plan: /media/Show/nope.mkv',
      instance: '/api/apply-plan',
    })
  })

  it('keeps the legacy Error Reason body for other Core errors', async () => {
    mocks.getPlan.mockRejectedValue(new Error('Plan not found: plan-1'))

    const response = await post({ id: 'plan-1' })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      error: 'Error Reason: Plan not found: plan-1',
    })
  })
})
