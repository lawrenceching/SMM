import type { Hono } from 'hono'
import type { MediaMetadata } from '@smm/core'
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
      const mm = await getCore().getMediaMetadata(path)
      if (mm === null) {
        const err: FolderMetadataResponseBody = {
          error: `Error Reason: No metadata cache for folder: ${path}`,
        }
        return c.json(err, 200)
      }
      const { files: _files, ...rest } = mm
      const ok: FolderMetadataResponseBody = { data: rest }
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
