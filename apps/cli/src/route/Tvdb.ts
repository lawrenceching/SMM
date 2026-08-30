import type { Hono } from 'hono'
import { getCore } from '../core/getCore'
import { logger } from '../../lib/logger'

export interface TvdbHttpResponseBody {
  data?: unknown
  error?: string
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

function parsePositiveInt(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number(value)
    if (parsed > 0) return parsed
  }
  return undefined
}

function tvdbRequestOptions(rec: Record<string, unknown>): {
  language?: string
  host?: string
  password?: string
  proxy?: string
} {
  return {
    language: optionalString(rec.language),
    host: optionalString(rec.host),
    password: optionalString(rec.password),
    proxy: optionalString(rec.proxy),
  }
}

async function readJsonObject(c: { req: { json: () => Promise<unknown> } }): Promise<Record<string, unknown>> {
  try {
    const body = await c.req.json()
    if (typeof body === 'object' && body !== null) {
      return body as Record<string, unknown>
    }
  } catch {
    /* empty / invalid JSON */
  }
  return {}
}

function errorBody(message: string): { error: string } {
  return { error: `Error Reason: ${message}` }
}

export function handleTvdb(app: Hono): void {
  app.post('/api/search-in-tvdb', async (c) => {
    try {
      const rec = await readJsonObject(c)
      const keyword = optionalString(rec.keyword)
      if (!keyword) {
        return c.json(errorBody('keyword is required'), 200)
      }
      const type = rec.type
      if (type !== 'series' && type !== 'movie') {
        return c.json(errorBody('type must be series or movie'), 200)
      }
      const data = await getCore().searchInTvdb(keyword, {
        type,
        ...tvdbRequestOptions(rec),
      })
      return c.json({ data }, 200)
    } catch (error) {
      logger.error({ error }, '[POST /api/search-in-tvdb] route error')
      return c.json(errorBody(error instanceof Error ? error.message : 'Unknown error'), 200)
    }
  })

  app.post('/api/get-tvshow-in-tvdb', async (c) => {
    try {
      const rec = await readJsonObject(c)
      const id = parsePositiveInt(rec.id)
      if (id === undefined) {
        return c.json(errorBody('id is required'), 200)
      }
      const data = await getCore().getTvShowInTvdb(id, tvdbRequestOptions(rec))
      return c.json({ data }, 200)
    } catch (error) {
      logger.error({ error }, '[POST /api/get-tvshow-in-tvdb] route error')
      return c.json(errorBody(error instanceof Error ? error.message : 'Unknown error'), 200)
    }
  })

  app.post('/api/get-movie-in-tvdb', async (c) => {
    try {
      const rec = await readJsonObject(c)
      const id = parsePositiveInt(rec.id)
      if (id === undefined) {
        return c.json(errorBody('id is required'), 200)
      }
      const data = await getCore().getMovieInTvdb(id, tvdbRequestOptions(rec))
      return c.json({ data }, 200)
    } catch (error) {
      logger.error({ error }, '[POST /api/get-movie-in-tvdb] route error')
      return c.json(errorBody(error instanceof Error ? error.message : 'Unknown error'), 200)
    }
  })

  app.post('/api/get-tvdb-languages', async (c) => {
    try {
      const data = await getCore().getTvdbLanguages(tvdbRequestOptions({}))
      return c.json({ data }, 200)
    } catch (error) {
      logger.error({ error }, '[POST /api/get-tvdb-languages] route error')
      return c.json(errorBody(error instanceof Error ? error.message : 'Unknown error'), 200)
    }
  })
}
