import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

const mocks = vi.hoisted(() => ({
  executeScrape: vi.fn(),
}))

vi.mock('@smm/core-routes', () => ({
  executeScrape: mocks.executeScrape,
}))

vi.mock('../../core/getCore', () => ({
  getCore: () => ({ scrapeFolder: vi.fn() }),
}))

vi.mock('../../../lib/logger', () => ({
  logger: { error: vi.fn() },
}))

import { debugScrapeToolRoute } from './debugScrapeTool'

describe('POST /debug/scrapeTool', () => {
  let app: Hono

  beforeEach(() => {
    mocks.executeScrape.mockReset()
    app = debugScrapeToolRoute
  })

  it('scrapes a folder', async () => {
    mocks.executeScrape.mockResolvedValue({ files: [] })

    const response = await app.request('/debug/scrapeTool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/media/Show' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true, data: { files: [] } })
  })

  it('reports scrape failures in-band', async () => {
    mocks.executeScrape.mockResolvedValue({ error: 'scrape failed' })

    const response = await app.request('/debug/scrapeTool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/media/Show' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: false,
      data: { error: 'scrape failed' },
      error: 'scrape failed',
    })
  })

  it('reports validation failures', async () => {
    const response = await app.request('/debug/scrapeTool', {
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
