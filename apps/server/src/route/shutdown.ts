import type { Hono } from 'hono';
import { logger } from '../../lib/logger';
import {
  isLocalhostShutdownRequest,
  runGracefulShutdown,
  scheduleProcessExit,
} from '../utils/gracefulShutdown';

export type ShutdownRequestIPResolver = (
  req: Request,
) => { address: string } | null;

let resolveRequestIP: ShutdownRequestIPResolver | null = null;

export function setShutdownRequestIPResolver(
  resolver: ShutdownRequestIPResolver | null,
): void {
  resolveRequestIP = resolver;
}

export function handleShutdown(app: Hono) {
  app.post('/api/shutdown', async (c) => {
    const req = c.req.raw;

    if (
      !isLocalhostShutdownRequest(
        req,
        resolveRequestIP ? (request) => resolveRequestIP!(request) : undefined,
      )
    ) {
      logger.warn('[shutdown] rejected non-localhost request');
      return c.json({ error: 'Forbidden' }, 403);
    }

    const result = await runGracefulShutdown();
    if (!result.ok) {
      return c.json({ error: 'Shutdown failed' }, 503);
    }

    scheduleProcessExit();
    return c.json({ ok: true, alreadyShuttingDown: result.alreadyShuttingDown });
  });
}
