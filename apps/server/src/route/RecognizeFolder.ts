import { Hono } from 'hono'
import type { RecognizeFolderDb } from '@smm/core'
import { getCore } from '../core/getCore'
import { logger } from '../../lib/logger'

type RecognizeFolderResponseBody =
  | { data: { path: string } }
  | { error: string }

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

function parseDb(value: unknown): RecognizeFolderDb | undefined {
  if (value === 'tmdb' || value === 'tvdb') return value
  return undefined
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

function errorBody(message: string): RecognizeFolderResponseBody {
  return { error: `Error Reason: ${message}` }
}

/** `POST /api/recognize-folder` → `Core.recognizeFolder`. */
export const recognizeFolderRoute = new Hono().post('/api/recognize-folder', async (c) => {
  try {
    const rec = await readJsonObject(c)
    const path = optionalString(rec.path)
    if (!path) {
      return c.json<RecognizeFolderResponseBody>(errorBody('path is required'), 200)
    }
    const db = parseDb(rec.db)
    if (!db) {
      return c.json<RecognizeFolderResponseBody>(errorBody('db must be tmdb or tvdb'), 200)
    }
    const id = optionalString(rec.id)
    if (!id) {
      return c.json<RecognizeFolderResponseBody>(errorBody('id is required'), 200)
    }

    await getCore().recognizeFolder(path, { db, id })

    const ok: RecognizeFolderResponseBody = { data: { path } }
    return c.json<RecognizeFolderResponseBody>(ok, 200)
  } catch (error) {
    logger.error({ error }, '[POST /api/recognize-folder] route error')
    const err: RecognizeFolderResponseBody = errorBody(
      error instanceof Error ? error.message : 'Unknown error',
    )
    return c.json<RecognizeFolderResponseBody>(err, 200)
  }
})
