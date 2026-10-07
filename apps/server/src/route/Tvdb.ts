import { Hono } from 'hono'
import type { Core } from '@smm/core'
import { getCore } from '../core/getCore'
import { logger } from '../../lib/logger'

type TvdbSearchData = Awaited<ReturnType<Core['searchInTvdb']>>
type TvdbTvShowData = Awaited<ReturnType<Core['getTvShowInTvdb']>>
type TvdbMovieData = Awaited<ReturnType<Core['getMovieInTvdb']>>
type TvdbLanguagesData = Awaited<ReturnType<Core['getTvdbLanguages']>>

type TvdbSearchHttpResponseBody =
  | { data: TvdbSearchData }
  | { error: string }

type TvdbTvShowHttpResponseBody =
  | { data: TvdbTvShowData }
  | { error: string }

type TvdbMovieHttpResponseBody =
  | { data: TvdbMovieData }
  | { error: string }

type TvdbLanguagesHttpResponseBody =
  | { data: TvdbLanguagesData }
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

export const tvdbRoute = new Hono()
  .post('/api/search-in-tvdb', async (c) => {
    try {
      const rec = await readJsonObject(c)
      const keyword = optionalString(rec.keyword)
      if (!keyword) {
        return c.json<TvdbSearchHttpResponseBody>(errorBody('keyword is required'), 200)
      }
      const type = rec.type
      if (type !== 'series' && type !== 'movie') {
        return c.json<TvdbSearchHttpResponseBody>(errorBody('type must be series or movie'), 200)
      }
      const data = await getCore().searchInTvdb(keyword, {
        type,
        ...tvdbRequestOptions(rec),
      })
      return c.json<TvdbSearchHttpResponseBody>({ data }, 200)
    } catch (error) {
      logger.error({ error }, '[POST /api/search-in-tvdb] route error')
      return c.json<TvdbSearchHttpResponseBody>(
        errorBody(error instanceof Error ? error.message : 'Unknown error'),
        200,
      )
    }
  })
  .post('/api/get-tvshow-in-tvdb', async (c) => {
    try {
      const rec = await readJsonObject(c)
      const id = parsePositiveInt(rec.id)
      if (id === undefined) {
        return c.json<TvdbTvShowHttpResponseBody>(errorBody('id is required'), 200)
      }
      const data = await getCore().getTvShowInTvdb(id, tvdbRequestOptions(rec))
      return c.json<TvdbTvShowHttpResponseBody>({ data }, 200)
    } catch (error) {
      logger.error({ error }, '[POST /api/get-tvshow-in-tvdb] route error')
      return c.json<TvdbTvShowHttpResponseBody>(
        errorBody(error instanceof Error ? error.message : 'Unknown error'),
        200,
      )
    }
  })
  .post('/api/get-movie-in-tvdb', async (c) => {
    try {
      const rec = await readJsonObject(c)
      const id = parsePositiveInt(rec.id)
      if (id === undefined) {
        return c.json<TvdbMovieHttpResponseBody>(errorBody('id is required'), 200)
      }
      const data = await getCore().getMovieInTvdb(id, tvdbRequestOptions(rec))
      return c.json<TvdbMovieHttpResponseBody>({ data }, 200)
    } catch (error) {
      logger.error({ error }, '[POST /api/get-movie-in-tvdb] route error')
      return c.json<TvdbMovieHttpResponseBody>(
        errorBody(error instanceof Error ? error.message : 'Unknown error'),
        200,
      )
    }
  })
  .post('/api/get-tvdb-languages', async (c) => {
    try {
      const data = await getCore().getTvdbLanguages(tvdbRequestOptions({}))
      return c.json<TvdbLanguagesHttpResponseBody>({ data }, 200)
    } catch (error) {
      logger.error({ error }, '[POST /api/get-tvdb-languages] route error')
      return c.json<TvdbLanguagesHttpResponseBody>(
        errorBody(error instanceof Error ? error.message : 'Unknown error'),
        200,
      )
    }
  })
