import type { ListFilesRequestBody, ListFilesResponseBody } from '@core/types';
import type { Hono } from 'hono';
import { doListFiles as doListFilesCore } from '@smm/core-routes';
import { logger } from '../../lib/logger';

const coreRoutesLogger = {
  debug: (obj: Record<string, unknown>, msg?: string) => logger.debug(obj, msg),
  info: (obj: Record<string, unknown>, msg?: string) => logger.info(obj, msg),
  warn: (obj: Record<string, unknown>, msg?: string) => logger.warn(obj, msg),
  error: (obj: Record<string, unknown>, msg?: string) => logger.error(obj, msg),
};

export async function doListFiles(body: ListFilesRequestBody): Promise<ListFilesResponseBody> {
  return doListFilesCore(body, { logger: coreRoutesLogger });
}

export function handleListFiles(app: Hono) {
  app.get('/api/listFiles', async (c) => {
    const query = c.req.query();
    logger.info({ query }, '[ListFiles] GET /api/listFiles');
    try {
      const body: ListFilesRequestBody = {
        path: query.path || '',
      };
      if (query.onlyFiles !== undefined) {
        body.onlyFiles = query.onlyFiles === 'true';
      }
      if (query.onlyFolders !== undefined) {
        body.onlyFolders = query.onlyFolders === 'true';
      }
      if (query.includeHiddenFiles !== undefined) {
        body.includeHiddenFiles = query.includeHiddenFiles === 'true';
      }
      if (query.recursively !== undefined) {
        body.recursively = query.recursively === 'true';
      }
      const result = await doListFiles(body);
      if (result.error) {
        logger.info({ body, resultError: result.error }, '[ListFiles] GET result has error');
      }
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'ListFiles GET route error');
      return c.json({
        data: {
          path: '',
          items: [],
          size: 0,
        },
        error: `Unexpected Error: ${error instanceof Error ? error.message : 'Failed to process list files request'}`,
      }, 200);
    }
  });

  app.post('/api/listFiles', async (c) => {
    try {
      const rawBody = await c.req.json();
      logger.info({ rawBody }, '[ListFiles] POST /api/listFiles');
      const result = await doListFiles(rawBody);
      if (result.error) {
        logger.info({ rawBody, resultError: result.error }, '[ListFiles] POST result has error');
      }
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'ListFiles POST route error');
      return c.json({
        data: {
          path: '',
          items: [],
          size: 0,
        },
        error: `Unexpected Error: ${error instanceof Error ? error.message : 'Failed to process list files request'}`,
      }, 200);
    }
  });
}
