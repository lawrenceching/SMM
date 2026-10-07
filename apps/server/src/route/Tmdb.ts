import { Hono } from 'hono'
import type { TmdbMovieDetails, TmdbSearchResponseBody, TmdbSeriesDetails } from '@smm/types'
import { getCore } from '../core/getCore'
import { logger } from '../../lib/logger'

type TmdbSearchHttpResponseBody =
  | { data: TmdbSearchResponseBody }
  | { error: string }

type TmdbMovieHttpResponseBody =
  | { data: TmdbMovieDetails }
  | { error: string }

type TmdbTvShowHttpResponseBody =
  | { data: TmdbSeriesDetails }
  | { error: string }

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

export const tmdbRoute = new Hono()
  .post('/api/search-in-tmdb', async (c) => {
    try {
      const rec = await readJsonObject(c)
      const keyword = optionalString(rec.keyword)
      if (!keyword) {
        return c.json<TmdbSearchHttpResponseBody>(errorBody('keyword is required'), 200)
      }
      const type = rec.type
      if (type !== 'tv' && type !== 'movie') {
        return c.json<TmdbSearchHttpResponseBody>(errorBody('type must be tv or movie'), 200)
      }
      const data = await getCore().searchInTmdb(keyword, {
        type,
        ...tmdbRequestOptions(rec),
      })
      return c.json<TmdbSearchHttpResponseBody>({ data }, 200)
    } catch (error) {
      logger.error({ error }, '[POST /api/search-in-tmdb] route error')
      return c.json<TmdbSearchHttpResponseBody>(
        errorBody(error instanceof Error ? error.message : 'Unknown error'),
        200,
      )
    }
  })
  .post('/api/get-movie-in-tmdb', async (c) => {
    try {
      const rec = await readJsonObject(c)
      const id = parsePositiveInt(rec.id)
      if (id === undefined) {
        return c.json<TmdbMovieHttpResponseBody>(errorBody('id is required'), 200)
      }
      const data = await getCore().getMovieInTmdb(id, tmdbRequestOptions(rec))
      return c.json<TmdbMovieHttpResponseBody>({ data }, 200)
    } catch (error) {
      logger.error({ error }, '[POST /api/get-movie-in-tmdb] route error')
      return c.json<TmdbMovieHttpResponseBody>(
        errorBody(error instanceof Error ? error.message : 'Unknown error'),
        200,
      )
    }
  })
  .post('/api/get-tvshow-in-tmdb', async (c) => {
    const startedAt = Date.now()
    let idForLog: number | undefined
    try {
      const rec = await readJsonObject(c)
      const id = parsePositiveInt(rec.id)
      idForLog = id
      if (id === undefined) {
        return c.json<TmdbTvShowHttpResponseBody>(errorBody('id is required'), 200)
      }
      logger.info({ id }, '[POST /api/get-tvshow-in-tmdb] start')
      const data = await getCore().getTvShowInTmdb(id, tmdbRequestOptions(rec))
      logger.info(
        { id, durationMs: Date.now() - startedAt },
        '[POST /api/get-tvshow-in-tmdb] ok',
      )
      return c.json<TmdbTvShowHttpResponseBody>({ data }, 200)
    } catch (error) {
      logger.error(
        { error, id: idForLog, durationMs: Date.now() - startedAt },
        '[POST /api/get-tvshow-in-tmdb] route error',
      )
      return c.json<TmdbTvShowHttpResponseBody>(
        errorBody(error instanceof Error ? error.message : 'Unknown error'),
        200,
      )
    }
  })
