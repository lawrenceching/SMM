import { buildAllowlist } from '@/utils/buildAllowlist';
import { isError, ExistedFileError } from '@core/errors';
import type { WriteFileRequestBody, WriteFileResponseBody } from '@core/types';
import { doWriteFile as doWriteFileCore } from '@smm/core-routes';
import type { Hono } from 'hono';
import { logger, logHttpReqIn, logHttpRespOut } from '../../lib/logger';

const coreRoutesLogger = {
  debug: (obj: Record<string, unknown>, msg?: string) => logger.debug(obj, msg),
  info: (obj: Record<string, unknown>, msg?: string) => logger.info(obj, msg),
  warn: (obj: Record<string, unknown>, msg?: string) => logger.warn(obj, msg),
  error: (obj: Record<string, unknown>, msg?: string) => logger.error(obj, msg),
};

export async function doWriteFile(body: WriteFileRequestBody, traceId: string = ''): Promise<WriteFileResponseBody> {
  const allowlist = await buildAllowlist();
  return doWriteFileCore(body, { allowlist, logger: coreRoutesLogger }, traceId);
}

export function handleWriteFile(app: Hono) {
  app.post('/api/writeFile', async (c) => {
    const traceId = c.req.header('X-Trace-Id') || '';

    try {
      const rawBody = await c.req.json();
      logHttpReqIn(c, rawBody);
      const result = await doWriteFile(rawBody, traceId);

      if (result.error) {
        if (isError(result.error, ExistedFileError)) {
          logHttpRespOut(c, result, 200);
          return c.json(result, 200);
        }
        logHttpRespOut(c, result, 400);
        return c.json(result, 400);
      }

      logHttpRespOut(c, result, 200);
      return c.json(result, 200);
    } catch (error) {
      const respBody = {
        error: 'Failed to process write file request',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
      logHttpRespOut(c, respBody, 500);
      return c.json(respBody, 500);
    }
  });
}

export { isError, ExistedFileError };
