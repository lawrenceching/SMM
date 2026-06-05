import type { Hono } from 'hono';
import { logger } from '../../lib/logger';

const DISCOVER_CONFIG_URL =
  'https://raw.gitcode.com/lawrenceching/simple-media-manager/raw/main/assets/config.json';

const DISCOVER_TIMEOUT_MS = 10_000;

export type MediaDatabaseType = 'tmdb' | 'tvdb';
export type MediaDatabaseAuthorizationMethod = 'date-token' | 'none';

/**
 * Raw entry as it appears in the remote config.json. The remote file
 * may use either `baseUrl` or `url` for the endpoint, and the
 * `authorizationMethod` may be omitted/null.
 */
export interface RemoteMediaDatabaseEntry {
  type: string;
  baseUrl?: string;
  url?: string;
  authorizationMethod?: string | null;
}

/**
 * Normalized entry returned to the UI. The endpoint URL is always
 * available on `url` and `authorizationMethod` is normalized to
 * "date-token" | "none" (defaulting to "none" when missing).
 */
export interface MediaDatabaseEntry {
  type: MediaDatabaseType;
  url: string;
  authorizationMethod: MediaDatabaseAuthorizationMethod;
}

export interface DiscoverResponseBody {
  data?: {
    mediaDatabases: MediaDatabaseEntry[];
  };
  error?: string;
}

function normalizeAuthorizationMethod(value: unknown): MediaDatabaseAuthorizationMethod {
  if (typeof value !== 'string') return 'none';
  if (value === 'date-token') return 'date-token';
  return 'none';
}

function normalizeEntry(entry: RemoteMediaDatabaseEntry): MediaDatabaseEntry | null {
  const endpointUrl = (entry.baseUrl ?? entry.url ?? '').trim();
  if (!endpointUrl) return null;

  const type = entry.type;
  if (type !== 'tmdb' && type !== 'tvdb') return null;

  return {
    type,
    url: endpointUrl,
    authorizationMethod: normalizeAuthorizationMethod(entry.authorizationMethod),
  };
}

/**
 * Fetch and normalize the remote media database config.
 * Returns an empty list on any error so the UI can gracefully fall back.
 */
export async function fetchDiscoveredMediaDatabases(): Promise<MediaDatabaseEntry[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DISCOVER_TIMEOUT_MS);

  try {
    const response = await fetch(DISCOVER_CONFIG_URL, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      logger.warn(
        { status: response.status, statusText: response.statusText },
        '[Discover] remote config returned non-OK status',
      );
      return [];
    }

    const body = (await response.json()) as { mediaDatabases?: unknown };
    const rawEntries = body.mediaDatabases;
    if (!Array.isArray(rawEntries)) {
      logger.warn('[Discover] remote config missing mediaDatabases array');
      return [];
    }

    const normalized: MediaDatabaseEntry[] = [];
    for (const raw of rawEntries) {
      if (!raw || typeof raw !== 'object') continue;
      const entry = normalizeEntry(raw as RemoteMediaDatabaseEntry);
      if (entry) normalized.push(entry);
    }
    return normalized;
  } catch (error) {
    logger.warn(
      { err: error instanceof Error ? error.message : String(error) },
      '[Discover] failed to fetch remote config',
    );
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export function handleDiscover(app: Hono) {
  app.get('/api/discover', async (c) => {
    const mediaDatabases = await fetchDiscoveredMediaDatabases();
    return c.json({ data: { mediaDatabases } });
  });
}
