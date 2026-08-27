import type { Hono } from 'hono'
import type { FolderType } from 'core-app'
import { getCore } from '../core/getCore'
import { logger } from '../../lib/logger'

const FOLDER_TYPES: readonly FolderType[] = ['tvshow', 'movie', 'music']

export interface ImportLibraryResponseBody {
  data?: { id: string }
  error?: string
}

function resolveFolderType(value: unknown): FolderType | undefined {
  if (value === 'anime') return 'tvshow'
  if (typeof value === 'string' && (FOLDER_TYPES as readonly string[]).includes(value)) {
    return value as FolderType
  }
  return undefined
}

export function handleImportLibrary(app: Hono): void {
  app.post('/api/import-library', async (c) => {
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
        const err: ImportLibraryResponseBody = { error: 'Error Reason: path is required' }
        return c.json(err, 200)
      }
      if (rec.type === undefined || rec.type === '') {
        const err: ImportLibraryResponseBody = { error: 'Error Reason: type is required' }
        return c.json(err, 200)
      }
      const type = resolveFolderType(rec.type)
      if (type === undefined) {
        const err: ImportLibraryResponseBody = {
          error: `Error Reason: Invalid folder type: ${String(rec.type)}`,
        }
        return c.json(err, 200)
      }
      const skipInit = rec.skipInit === true
      const { id } = getCore().importLibrary(path, type, skipInit ? { skipInit: true } : undefined)
      const ok: ImportLibraryResponseBody = { data: { id } }
      return c.json(ok, 200)
    } catch (error) {
      logger.error({ error }, '[POST /api/import-library] route error')
      const err: ImportLibraryResponseBody = {
        error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
      return c.json(err, 200)
    }
  })
}
