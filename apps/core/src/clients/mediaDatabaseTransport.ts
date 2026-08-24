import type { DiscoverPort, MediaDatabaseAuthorizationMethod, ReverseProxyEntry } from "../ports/DiscoverPort";
import type { FetchInit, HttpResponse, NetworkPort } from "../ports/NetworkPort";

export const SMM_TMDB_DEFAULT_UPSTREAM = "https://mediadb.vercel.app/api/tmdb";
export const SMM_TVDB_DEFAULT_UPSTREAM = "https://mediadb.vercel.app/api/tvdb";

export type MediaDatabaseKind = "tmdb" | "tvdb";

export class MediaDatabaseFailoverExhaustedError extends Error {
  readonly attemptedUrls: string[];

  constructor(attemptedUrls: string[]) {
    super(`All media-database failover attempts failed (${attemptedUrls.length} tried)`);
    this.name = "MediaDatabaseFailoverExhaustedError";
    this.attemptedUrls = attemptedUrls;
  }
}

export interface FetchMediaDatabaseOptions {
  kind: MediaDatabaseKind;
  /** API path including leading slash and query, e.g. `/search/tv?query=x`. */
  path: string;
  /** User-configured host; empty/undefined → discover default chain. */
  configuredHost?: string;
  apiKey?: string;
  httpProxy?: string;
  /** Local SMM reverse proxy base URL (required for reliable custom-host routing). */
  reverseProxyUrl?: string | null;
  discover?: DiscoverPort;
}

function normalizeBase(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function joinUrl(base: string, path: string): string {
  const cleanBase = normalizeBase(base);
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return cleanBase + cleanPath;
}

function isCustomHost(host: string | undefined, defaultUpstream: string): boolean {
  const trimmed = host?.trim() ?? "";
  if (!trimmed) return false;
  try {
    // eslint-disable-next-line no-new
    new URL(trimmed);
  } catch {
    return false;
  }
  return normalizeBase(trimmed) !== normalizeBase(defaultUpstream);
}

function dateToken(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function authHeaders(apiKey?: string): Record<string, string> {
  const key = apiKey?.trim();
  if (!key) return {};
  return { Authorization: `Bearer ${key}` };
}

/** In-process TVDB JWT cache keyed by normalized custom host. */
const tvdbTokenCache = new Map<
  string,
  { token: string; expiresAt: number }
>();
const TVDB_TOKEN_VALIDITY_MS = 30 * 24 * 60 * 60 * 1000; // ~1 month per docs
const TVDB_TOKEN_REFRESH_BUFFER_MS = 60 * 60 * 1000; // refresh 1h early

/** Test-only: clear the TVDB JWT cache. */
export function _resetTvdbTokenCacheForTests(): void {
  tvdbTokenCache.clear();
}

/**
 * Obtain a TVDB bearer JWT for a custom host via `POST /login`, caching it in
 * process memory and refreshing near expiry. The raw API key is NOT a bearer
 * token for TVDB v4; a login exchange is required.
 */
async function ensureTvdbToken(
  network: NetworkPort,
  host: string,
  apiKey: string | undefined,
  proxy: string | undefined,
): Promise<string> {
  const key = normalizeBase(host);
  const cached = tvdbTokenCache.get(key);
  if (cached && Date.now() < cached.expiresAt - TVDB_TOKEN_REFRESH_BUFFER_MS) {
    return cached.token;
  }

  const url = joinUrl(key, "/login");
  const resp = await network.fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ apikey: apiKey?.trim() || "" }),
    ...(proxy?.trim() ? { proxy: proxy.trim() } : {}),
  });
  if (!resp.ok) {
    throw new Error(`TVDB login failed: ${resp.status} ${resp.statusText}`);
  }
  const body = await resp.json<{ data?: { token?: string }; token?: string }>();
  const token = body?.data?.token ?? body?.token;
  if (typeof token !== "string" || !token) {
    throw new Error("TVDB login response missing token");
  }
  tvdbTokenCache.set(key, { token, expiresAt: Date.now() + TVDB_TOKEN_VALIDITY_MS });
  return token;
}

function generalProxyHeaders(
  upstreamBaseURL: string,
  authorizationMethod: MediaDatabaseAuthorizationMethod,
  apiKey?: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...authHeaders(apiKey),
    "X-Upstream-Base-Url": normalizeBase(upstreamBaseURL),
  };
  if (authorizationMethod === "date-token") {
    headers["X-Proxy-Authorization"] = `Bearer ${dateToken()}`;
  }
  return headers;
}

function localProxyHeaders(
  upstreamBaseURL: string,
  apiKey?: string,
  httpProxy?: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...authHeaders(apiKey),
    "X-SMM-Proxy-Upstream-BaseURL": normalizeBase(upstreamBaseURL),
  };
  const proxy = httpProxy?.trim();
  if (proxy) headers["X-Http-Proxy"] = proxy;
  return headers;
}

async function tryFetch(
  network: NetworkPort,
  url: string,
  headers: Record<string, string>,
  proxy?: string,
): Promise<HttpResponse | undefined> {
  try {
    const init: FetchInit = { method: "GET", headers };
    const trimmedProxy = proxy?.trim();
    if (trimmedProxy) init.proxy = trimmedProxy;
    const resp = await network.fetch(url, init);
    if (resp.ok) return resp;
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Fetch a TMDB/TVDB API path with the same routing policy as UI `fetchTmdb` / `fetchTvdb`:
 * - custom host → local reverse proxy (or direct if no reverseProxyUrl, for tests)
 * - default → discover hosts, each tried direct then via general reverse proxies
 */
export async function fetchMediaDatabase(
  network: NetworkPort,
  options: FetchMediaDatabaseOptions,
): Promise<HttpResponse> {
  const path = options.path.startsWith("/") ? options.path : `/${options.path}`;
  const defaultUpstream =
    options.kind === "tmdb" ? SMM_TMDB_DEFAULT_UPSTREAM : SMM_TVDB_DEFAULT_UPSTREAM;
  const attempted: string[] = [];

  if (isCustomHost(options.configuredHost, defaultUpstream)) {
    const upstream = normalizeBase(options.configuredHost!);
    const localProxy = options.reverseProxyUrl?.trim();
    if (localProxy) {
      const url = joinUrl(localProxy, path);
      attempted.push(url);
      const resp = await tryFetch(
        network,
        url,
        localProxyHeaders(upstream, options.apiKey, options.httpProxy),
      );
      if (resp !== undefined) return resp;
      throw new MediaDatabaseFailoverExhaustedError(attempted);
    }
    // Unit-test / CLI / no-proxy fallback: hit custom host directly via NetworkPort
    // (httpProxy is passed as NetworkPort `proxy`, not X-Http-Proxy).
    const url = joinUrl(upstream, path);
    attempted.push(url);
    let headers: Record<string, string> = { Accept: "application/json" };
    if (options.kind === "tvdb") {
      const token = await ensureTvdbToken(network, upstream, options.apiKey, options.httpProxy);
      headers.Authorization = `Bearer ${token}`;
    } else {
      Object.assign(headers, authHeaders(options.apiKey));
    }
    const resp = await tryFetch(network, url, headers, options.httpProxy);
    if (resp !== undefined) return resp;
    throw new MediaDatabaseFailoverExhaustedError(attempted);
  }

  const config = options.discover
    ? await options.discover.getDiscoverConfig()
    : { mediaDatabases: [], reverseProxies: [] as ReverseProxyEntry[] };

  let hosts = config.mediaDatabases
    .filter((e) => e.type === options.kind)
    .map((e) => normalizeBase(e.url))
    .filter(Boolean);

  if (hosts.length === 0) {
    hosts = [normalizeBase(defaultUpstream)];
  }

  const proxies = config.reverseProxies.filter((p) => {
    try {
      // eslint-disable-next-line no-new
      new URL(p.url);
      return true;
    } catch {
      return false;
    }
  });

  for (const host of hosts) {
    const directUrl = joinUrl(host, path);
    attempted.push(directUrl);
    const direct = await tryFetch(
      network,
      directUrl,
      {
        Accept: "application/json",
        ...authHeaders(options.apiKey),
      },
      options.httpProxy,
    );
    if (direct !== undefined) return direct;

    for (const proxy of proxies) {
      const proxyUrl = joinUrl(proxy.url, path);
      attempted.push(proxyUrl);
      const viaProxy = await tryFetch(
        network,
        proxyUrl,
        generalProxyHeaders(host, proxy.authorizationMethod, options.apiKey),
      );
      if (viaProxy !== undefined) return viaProxy;
    }
  }

  throw new MediaDatabaseFailoverExhaustedError(attempted);
}
