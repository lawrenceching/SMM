import type { Hono } from 'hono';
import {
  doFetchDiscoverConfig,
  doFetchDiscoveredMediaDatabases,
  EMPTY_DISCOVER_CONFIG,
  type DiscoverConfig,
  type DiscoverResponseBody,
  type MediaDatabaseEntry,
  type MediaDatabaseType,
  type MediaDatabaseAuthorizationMethod,
  type ReverseProxyEntry,
  type ReverseProxyType,
} from '@smm/core-routes/discover';
import { logger } from '../../lib/logger';

const coreRoutesLogger = {
  debug: (obj: Record<string, unknown>, msg?: string) => logger.debug(obj, msg),
  info: (obj: Record<string, unknown>, msg?: string) => logger.info(obj, msg),
  warn: (obj: Record<string, unknown>, msg?: string) => logger.warn(obj, msg),
  error: (obj: Record<string, unknown>, msg?: string) => logger.error(obj, msg),
};

export type {
  DiscoverConfig,
  DiscoverResponseBody,
  MediaDatabaseEntry,
  MediaDatabaseType,
  MediaDatabaseAuthorizationMethod,
  ReverseProxyEntry,
  ReverseProxyType,
};

/**
 * Fetch and normalize the remote discovery config.
 * Returns empty lists on any error so the UI can gracefully fall back.
 */
export async function fetchDiscoverConfig(): Promise<DiscoverConfig> {
  return doFetchDiscoverConfig({ logger: coreRoutesLogger });
}

/**
 * Fetch and normalize the remote media database config.
 * Returns an empty list on any error so the UI can gracefully fall back.
 */
export async function fetchDiscoveredMediaDatabases(): Promise<MediaDatabaseEntry[]> {
  return doFetchDiscoveredMediaDatabases({ logger: coreRoutesLogger });
}

/**
 * Hono shell for `GET /api/discover`.
 *
 * Delegates to `doFetchDiscoverConfig` from `@smm/core-routes` so CLI and
 * OHOS share the same remote-config fetch / normalize behavior.
 */
export function handleDiscover(app: Hono) {
  app.get('/api/discover', async (c) => {
    try {
      const config = await fetchDiscoverConfig();
      return c.json({ data: config });
    } catch (error) {
      // doFetchDiscoverConfig should never throw; this is a last-resort guard.
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message }, '[Discover] handleDiscover unexpected throw');
      return c.json({ data: { ...EMPTY_DISCOVER_CONFIG } });
    }
  });
}
