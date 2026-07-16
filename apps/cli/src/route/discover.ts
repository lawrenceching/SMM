import type { Hono } from 'hono';
import { logger, logHttpReqOut, logHttpRespIn } from '../../lib/logger';

const DISCOVER_CONFIG_URL =
  process.env.EXTERNAL_CONFIG_FILE_URL ||
  'https://raw.gitcode.com/lawrenceching/simple-media-manager/raw/main/assets/config.json';

const DISCOVER_TIMEOUT_MS = 10_000;

export type MediaDatabaseType = 'tmdb' | 'tvdb' | 'tmdb-asset' | 'tvdb-asset';
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

export type ReverseProxyType = 'general';

/**
 * Raw entry as it appears in the remote config.json. The remote file
 * uses `authMethod` for the authorization scheme.
 */
export interface RemoteReverseProxyEntry {
  id?: string;
  type?: string;
  url?: string;
  authMethod?: string | null;
}

/**
 * Normalized reverse-proxy entry returned to the UI.
 */
export interface ReverseProxyEntry {
  id: string;
  type: ReverseProxyType;
  url: string;
  authorizationMethod: MediaDatabaseAuthorizationMethod;
}

export interface DiscoverConfig {
  mediaDatabases: MediaDatabaseEntry[];
  reverseProxies: ReverseProxyEntry[];
}

export interface DiscoverResponseBody {
  data?: DiscoverConfig;
  error?: string;
}

function normalizeAuthorizationMethod(value: unknown): MediaDatabaseAuthorizationMethod {
  if (typeof value !== 'string') return 'none';
  if (value === 'date-token') return 'date-token';
  return 'none';
}

function normalizeMediaDatabaseEntry(entry: RemoteMediaDatabaseEntry): MediaDatabaseEntry | null {
  const endpointUrl = (entry.baseUrl ?? entry.url ?? '').trim();
  if (!endpointUrl) return null;

  const type = entry.type;
  if (type !== 'tmdb' && type !== 'tvdb' && type !== 'tmdb-asset' && type !== 'tvdb-asset') {
    return null;
  }

  return {
    type,
    url: endpointUrl,
    authorizationMethod: normalizeAuthorizationMethod(entry.authorizationMethod),
  };
}

function normalizeReverseProxyEntry(entry: RemoteReverseProxyEntry): ReverseProxyEntry | null {
  const id = (entry.id ?? '').trim();
  const url = (entry.url ?? '').trim();
  if (!id || !url) return null;

  const type = entry.type;
  if (type !== 'general') return null;

  return {
    id,
    type,
    url,
    authorizationMethod: normalizeAuthorizationMethod(entry.authMethod),
  };
}

function normalizeMediaDatabases(rawEntries: unknown): MediaDatabaseEntry[] {
  if (!Array.isArray(rawEntries)) {
    return [];
  }

  const normalized: MediaDatabaseEntry[] = [];
  for (const raw of rawEntries) {
    if (!raw || typeof raw !== 'object') continue;
    const entry = normalizeMediaDatabaseEntry(raw as RemoteMediaDatabaseEntry);
    if (entry) normalized.push(entry);
  }
  return normalized;
}

function normalizeReverseProxies(rawEntries: unknown): ReverseProxyEntry[] {
  if (!Array.isArray(rawEntries)) {
    return [];
  }

  const normalized: ReverseProxyEntry[] = [];
  for (const raw of rawEntries) {
    if (!raw || typeof raw !== 'object') continue;
    const entry = normalizeReverseProxyEntry(raw as RemoteReverseProxyEntry);
    if (entry) normalized.push(entry);
  }
  return normalized;
}

function formatFetchError(error: unknown): {
  message: string;
  name?: string;
  cause?: string;
} {
  if (!(error instanceof Error)) {
    return { message: String(error) };
  }
  const cause = error.cause;
  return {
    message: error.message,
    name: error.name,
    cause:
      cause instanceof Error
        ? cause.message
        : cause !== undefined
          ? String(cause)
          : undefined,
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function logEmptyDiscoverResult(
  url: string,
  durationMs: number,
  body: { mediaDatabases?: unknown; reverseProxies?: unknown },
  mediaDatabases: MediaDatabaseEntry[],
): void {
  const rawMediaDatabasesCount = Array.isArray(body.mediaDatabases)
    ? body.mediaDatabases.length
    : null;
  const rawReverseProxiesCount = Array.isArray(body.reverseProxies)
    ? body.reverseProxies.length
    : null;

  if (rawMediaDatabasesCount === null) {
    logger.warn(
      {
        url,
        durationMs,
        hasMediaDatabasesField: false,
        rawReverseProxiesCount,
      },
      '[Discover] remote config missing mediaDatabases array',
    );
    return;
  }

  if (rawMediaDatabasesCount === 0) {
    logger.warn(
      {
        url,
        durationMs,
        rawMediaDatabasesCount,
        rawReverseProxiesCount,
      },
      '[Discover] remote config has empty mediaDatabases array',
    );
    return;
  }

  if (mediaDatabases.length === 0) {
    logger.warn(
      {
        url,
        durationMs,
        rawMediaDatabasesCount,
        normalizedMediaDatabasesCount: 0,
        rawReverseProxiesCount,
      },
      '[Discover] remote config mediaDatabases entries were all filtered out during normalization',
    );
  }
}

/**
 * Fetch and normalize the remote discovery config.
 * Returns empty lists on any error so the UI can gracefully fall back.
 */
export async function fetchDiscoverConfig(): Promise<DiscoverConfig> {
  const url = DISCOVER_CONFIG_URL;
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DISCOVER_TIMEOUT_MS);

  logger.info({ url, timeoutMs: DISCOVER_TIMEOUT_MS }, '[Discover] fetching remote config');
  logHttpReqOut(url, 'GET');

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    const durationMs = Date.now() - startedAt;
    logHttpRespIn(url, response.status);

    if (!response.ok) {
      logger.warn(
        {
          url,
          durationMs,
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers.get('content-type'),
        },
        '[Discover] remote config returned non-OK status',
      );
      return { mediaDatabases: [], reverseProxies: [] };
    }

    let body: { mediaDatabases?: unknown; reverseProxies?: unknown };
    try {
      body = (await response.json()) as typeof body;
    } catch (parseError) {
      logger.warn(
        {
          url,
          durationMs,
          contentType: response.headers.get('content-type'),
          err: formatFetchError(parseError),
        },
        '[Discover] remote config response is not valid JSON',
      );
      return { mediaDatabases: [], reverseProxies: [] };
    }

    const mediaDatabases = normalizeMediaDatabases(body.mediaDatabases);
    const reverseProxies = normalizeReverseProxies(body.reverseProxies);

    if (mediaDatabases.length === 0) {
      logEmptyDiscoverResult(url, durationMs, body, mediaDatabases);
    } else {
      logger.info(
        {
          url,
          durationMs,
          mediaDatabasesCount: mediaDatabases.length,
          reverseProxiesCount: reverseProxies.length,
          mediaDatabaseTypes: [...new Set(mediaDatabases.map((entry) => entry.type))],
        },
        '[Discover] remote config loaded',
      );
    }

    return { mediaDatabases, reverseProxies };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const aborted = isAbortError(error);
    logger.warn(
      {
        url,
        durationMs,
        aborted,
        timedOut: aborted && durationMs >= DISCOVER_TIMEOUT_MS - 50,
        err: formatFetchError(error),
      },
      aborted
        ? '[Discover] remote config fetch aborted (timeout or cancellation)'
        : '[Discover] failed to fetch remote config',
    );
    return { mediaDatabases: [], reverseProxies: [] };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch and normalize the remote media database config.
 * Returns an empty list on any error so the UI can gracefully fall back.
 */
export async function fetchDiscoveredMediaDatabases(): Promise<MediaDatabaseEntry[]> {
  const config = await fetchDiscoverConfig();
  return config.mediaDatabases;
}

export function handleDiscover(app: Hono) {
  app.get('/api/discover', async (c) => {
    const config = await fetchDiscoverConfig();
    return c.json({ data: config });
  });
}
