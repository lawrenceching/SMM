import type { Hono } from 'hono'
import { getCore } from '../core/getCore'
import { logger } from '../../lib/logger'

export interface ScrapeResponseBody {
  data?: { id: string }
  error?: string
}

export function handleScrape(app: Hono): void {
  app.post('/api/scrape', async (c) => {
    try {
      let body: unknown = {}
      try {
        body = await c.req.json()
      } catch {
        /* empty body */
      }
      const rec = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
      const path = rec.path
      if (typeof path !== 'string' || path.trim() === '') {
        const err: ScrapeResponseBody = { error: 'Error Reason: path is required' }
        return c.json(err, 200)
      }
      const language =
        typeof rec.language === 'string' && rec.language.trim() !== ''
          ? rec.language
          : undefined
      const { id } = await getCore().scrapeFolder(
        path,
        language !== undefined ? { language } : undefined,
      )
      const ok: ScrapeResponseBody = { data: { id } }
      return c.json(ok, 200)
    } catch (error) {
      logger.error({ error }, '[POST /api/scrape] route error')
      const err: ScrapeResponseBody = {
        error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
      return c.json(err, 200)
    }
  })
}
