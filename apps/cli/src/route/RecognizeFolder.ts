import type { Hono } from 'hono'
import type { RecognizeFolderDb } from 'core-app'
import { getCore } from '../core/getCore'
import { logger } from '../../lib/logger'

export interface RecognizeFolderRequestBody {
  path: string
  db: RecognizeFolderDb
  id: string
}

export interface RecognizeFolderResponseBody {
  data?: { path: string }
  error?: string
}

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
export function handleRecognizeFolder(app: Hono): void {
  app.post('/api/recognize-folder', async (c) => {
    try {
      const rec = await readJsonObject(c)
      const path = optionalString(rec.path)
      if (!path) {
        return c.json(errorBody('path is required'), 200)
      }
      const db = parseDb(rec.db)
      if (!db) {
        return c.json(errorBody('db must be tmdb or tvdb'), 200)
      }
      const id = optionalString(rec.id)
      if (!id) {
        return c.json(errorBody('id is required'), 200)
      }

      await getCore().recognizeFolder(path, { db, id })

      const ok: RecognizeFolderResponseBody = { data: { path } }
      return c.json(ok, 200)
    } catch (error) {
      logger.error({ error }, '[POST /api/recognize-folder] route error')
      return c.json(
        errorBody(error instanceof Error ? error.message : 'Unknown error'),
        200,
      )
    }
  })
}
