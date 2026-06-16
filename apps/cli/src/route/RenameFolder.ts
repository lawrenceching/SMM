import { Path } from '@core/path';
import type { FolderRenameRequestBody, FolderRenameResponseBody } from '@core/types';
import {
  doRenameFolder as doRenameFolderCore,
  type CoreRoutesLogger,
} from '@smm/core-routes';
import { broadcastUserConfigFolderRenamedEvent } from '@/events/userConfigUpdatedEvent';
import { broadcast } from '@/utils/socketIO';
import type { Hono } from 'hono';
import { logger } from '../../lib/logger';
import { buildCoreRoutesConfig } from './coreRoutesConfig';

const coreRoutesLogger: CoreRoutesLogger = {
  debug: (obj, msg) => logger.debug(obj, msg),
  info: (obj, msg) => logger.info(obj, msg),
  warn: (obj, msg) => logger.warn(obj, msg),
  error: (obj, msg) => logger.error(obj, msg),
};

export async function doRenameFolder(
  body: FolderRenameRequestBody,
  clientId?: string,
): Promise<FolderRenameResponseBody> {
  const config = await buildCoreRoutesConfig(coreRoutesLogger);
  const result = await doRenameFolderCore(body, config);

  if (!result.error) {
    const fromAsPosix = Path.posix(body.from);
    const toAsPosix = Path.posix(body.to);

    broadcastUserConfigFolderRenamedEvent({
      from: Path.toPlatformPath(fromAsPosix),
      to: Path.toPlatformPath(toAsPosix),
    });

    broadcast({
      clientId,
      event: 'userConfigUpdated',
      data: {},
    });
  }

  return result;
}

export function handleRenameFolder(app: Hono) {
  app.post('/api/renameFolder', async (c) => {
    try {
      const rawBody = await c.req.json();
      const clientId = c.req.header('clientId');
      logger.info(
        `[HTTP_IN] ${c.req.method} ${c.req.url} ${rawBody.from} -> ${rawBody.to} (clientId: ${clientId || 'not provided'})`,
      );
      const result = await doRenameFolder(rawBody, clientId);
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'RenameFolder route error:');
      return c.json(
        {
          error: 'Unexpected Error: Failed to process rename folder request',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        200,
      );
    }
  });
}
