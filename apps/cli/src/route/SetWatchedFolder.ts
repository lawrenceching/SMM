import type { Hono } from 'hono';
import type {
  SetWatchedFolderRequestBody,
  SetWatchedFolderResponseBody,
} from '@core/types';
import { getFolderWatcher } from '../services/folderWatcher';
import { logger, logHttpReqIn, logHttpRespOut } from '../../lib/logger';

export async function processSetWatchedFolder(
  body: SetWatchedFolderRequestBody,
): Promise<SetWatchedFolderResponseBody> {
  const folderPath =
    body?.folderPath === undefined
      ? null
      : body.folderPath === null || String(body.folderPath).trim() === ''
        ? null
        : String(body.folderPath);

  const watcher = getFolderWatcher();
  watcher.setWatchedFolder(folderPath);

  return {
    data: {
      watchedFolder: folderPath,
    },
  };
}

export function handleSetWatchedFolder(app: Hono) {
  app.post('/api/setWatchedFolder', async (c) => {
    try {
      const rawBody = await c.req.json().catch(() => ({}));
      logHttpReqIn(c, rawBody);
      const result = await processSetWatchedFolder(rawBody as SetWatchedFolderRequestBody);
      logHttpRespOut(c, result, 200);
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'SetWatchedFolder route error');
      const respBody: SetWatchedFolderResponseBody = {
        data: { watchedFolder: null },
        error: `Error Reason: ${
          error instanceof Error ? error.message : 'Failed to set watched folder'
        }`,
      };
      logHttpRespOut(c, respBody, 200);
      return c.json(respBody, 200);
    }
  });
}
