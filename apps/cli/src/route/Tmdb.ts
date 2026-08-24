import type { Hono } from 'hono'
import { getCore } from '../core/getCore'
import { logger } from '../../lib/logger'

export interface TmdbSearchHttpResponseBody {
  data?: unknown
  error?: string
}

export interface TmdbDetailsHttpResponseBody {
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

function tmdbRequestOptions(rec: Record<string, unknown>): {
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

export function handleTmdb(app: Hono): void {
  app.post('/api/search-in-tmdb', async (c) => {
    try {
      const rec = await readJsonObject(c)
      const keyword = optionalString(rec.keyword)
      if (!keyword) {
        const err: TmdbSearchHttpResponseBody = errorBody('keyword is required')
        return c.json(err, 200)
      }
      const type = rec.type
      if (type !== 'tv' && type !== 'movie') {
        const err: TmdbSearchHttpResponseBody = errorBody('type must be tv or movie')
        return c.json(err, 200)
      }
      const data = await getCore().searchInTmdb(keyword, {
        type,
        ...tmdbRequestOptions(rec),
      })
      const ok: TmdbSearchHttpResponseBody = { data }
      return c.json(ok, 200)
    } catch (error) {
      logger.error({ error }, '[POST /api/search-in-tmdb] route error')
      const err: TmdbSearchHttpResponseBody = errorBody(
        error instanceof Error ? error.message : 'Unknown error',
      )
      return c.json(err, 200)
    }
  })

  app.post('/api/get-movie-in-tmdb', async (c) => {
    try {
      const rec = await readJsonObject(c)
      const id = parsePositiveInt(rec.id)
      if (id === undefined) {
        const err: TmdbDetailsHttpResponseBody = errorBody('id is required')
        return c.json(err, 200)
      }
      const data = await getCore().getMovieInTmdb(id, tmdbRequestOptions(rec))
      const ok: TmdbDetailsHttpResponseBody = { data }
      return c.json(ok, 200)
    } catch (error) {
      logger.error({ error }, '[POST /api/get-movie-in-tmdb] route error')
      const err: TmdbDetailsHttpResponseBody = errorBody(
        error instanceof Error ? error.message : 'Unknown error',
      )
      return c.json(err, 200)
    }
  })

  app.post('/api/get-tvshow-in-tmdb', async (c) => {
    try {
      const rec = await readJsonObject(c)
      const id = parsePositiveInt(rec.id)
      if (id === undefined) {
        const err: TmdbDetailsHttpResponseBody = errorBody('id is required')
        return c.json(err, 200)
      }
      const data = await getCore().getTvShowInTmdb(id, tmdbRequestOptions(rec))
      const ok: TmdbDetailsHttpResponseBody = { data }
      return c.json(ok, 200)
    } catch (error) {
      logger.error({ error }, '[POST /api/get-tvshow-in-tmdb] route error')
      const err: TmdbDetailsHttpResponseBody = errorBody(
        error instanceof Error ? error.message : 'Unknown error',
      )
      return c.json(err, 200)
    }
  })
}
