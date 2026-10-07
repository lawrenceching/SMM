import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

const mocks = vi.hoisted(() => ({
  executeGetJob: vi.fn(),
}))

vi.mock('@smm/core-routes', () => ({
  executeGetJob: mocks.executeGetJob,
}))

vi.mock('../../core/getCore', () => ({
  getCore: () => ({ getJob: vi.fn() }),
}))

vi.mock('../../../lib/logger', () => ({
  logger: { error: vi.fn() },
}))

import { debugGetJobToolRoute } from './debugGetJobTool'

describe('POST /debug/getJobTool', () => {
  let app: Hono

  beforeEach(() => {
    mocks.executeGetJob.mockReset()
    app = debugGetJobToolRoute
  })

  it('returns job details', async () => {
    mocks.executeGetJob.mockResolvedValue({ id: 'job-1' })

    const response = await app.request('/debug/getJobTool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'job-1' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { id: 'job-1' },
    })
  })

  it('reports job lookup failures in-band', async () => {
    mocks.executeGetJob.mockResolvedValue({ id: 'job-1', error: 'job not found' })

    const response = await app.request('/debug/getJobTool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'job-1' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: false,
      data: { id: 'job-1', error: 'job not found' },
      error: 'job not found',
    })
  })

  it('reports validation failures', async () => {
    const response = await app.request('/debug/getJobTool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(response.status).toBe(200)
    const json = (await response.json()) as { success: boolean; error: string }
    expect(json.success).toBe(false)
    expect(json.error).toMatch(/^Validation failed:/)
  })
})
