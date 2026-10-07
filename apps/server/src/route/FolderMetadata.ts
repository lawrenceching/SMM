import { Hono } from 'hono'
import type { MediaMetadata } from '@smm/types'
import { getCore } from '../core/getCore'
import { logger } from '../../lib/logger'
import { isFolderImported } from '@server/folderDisplay'

type FolderMetadataResponseBody =
  | { data: Omit<MediaMetadata, 'files'> }
  | { error: string }

export const folderMetadataRoute = new Hono().post('/api/folder-metadata', async (c) => {
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
      return c.json<FolderMetadataResponseBody>(
        { error: 'Error Reason: path is required' },
        200,
      )
    }
    if (!(await isFolderImported(path))) {
      return c.json<FolderMetadataResponseBody>(
        { error: `Error Reason: Folder is not imported: ${path}` },
        200,
      )
    }
    let mm: MediaMetadata
    try {
      mm = await getCore().getMetadata(path)
    } catch (error) {
      if (error instanceof Error && error.name === 'MetadataNotFoundError') {
        return c.json<FolderMetadataResponseBody>(
          { error: `Error Reason: No metadata cache for folder: ${path}` },
          200,
        )
      }
      throw error
    }
    return c.json<FolderMetadataResponseBody>({ data: mm }, 200)
  } catch (error) {
    logger.error({ error }, '[POST /api/folder-metadata] route error')
    return c.json<FolderMetadataResponseBody>(
      { error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}` },
      200,
    )
  }
})
