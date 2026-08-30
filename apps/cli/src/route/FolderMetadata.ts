import type { Hono } from 'hono'
import type { MediaMetadata } from '@smm/types'
import { getCore } from '../core/getCore'
import { logger } from '../../lib/logger'
import { isFolderImported } from '../cli/folderDisplay'

export interface FolderMetadataResponseBody {
  data?: Omit<MediaMetadata, 'files'>
  error?: string
}

export function handleFolderMetadata(app: Hono): void {
  app.post('/api/folder-metadata', async (c) => {
    try {
      let body: unknown = {}
      try {
        body = await c.req.json()
      } catch {
        /* empty body */
      }
      const path =
        typeof body === 'object' && body !== null && 'path' in body
          ? (body as { path: unknown }).path
          : undefined
      if (typeof path !== 'string' || path.trim() === '') {
        const err: FolderMetadataResponseBody = { error: 'Error Reason: path is required' }
        return c.json(err, 200)
      }
      if (!(await isFolderImported(path))) {
        const err: FolderMetadataResponseBody = {
          error: `Error Reason: Folder is not imported: ${path}`,
        }
        return c.json(err, 200)
      }
      let mm: MediaMetadata
      try {
        mm = await getCore().getMetadata(path)
      } catch (error) {
        if (error instanceof Error && error.name === 'MetadataNotFoundError') {
          const err: FolderMetadataResponseBody = {
            error: `Error Reason: No metadata cache for folder: ${path}`,
          }
          return c.json(err, 200)
        }
        throw error
      }
      const ok: FolderMetadataResponseBody = { data: mm }
      return c.json(ok, 200)
    } catch (error) {
      logger.error({ error }, '[POST /api/folder-metadata] route error')
      const err: FolderMetadataResponseBody = {
        error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
      return c.json(err, 200)
    }
  })
}
