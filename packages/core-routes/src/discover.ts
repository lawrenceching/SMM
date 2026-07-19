import type { CoreRoutesConfig, CoreRoutesLogger } from "./types.ts";

type DiscoverLogLevel = "info" | "warn" | "error";

function discoverLog(
  logger: CoreRoutesLogger | undefined,
  level: DiscoverLogLevel,
  message: string,
  details?: Record<string, unknown>,
): void {
  const payload = details ?? {};
  const msg = `[Discover] ${message}`;
  if (logger) {
    logger[level](payload, msg);
    return;
  }
  const line =
    details === undefined ? msg : `${msg} ${JSON.stringify(details)}`;
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

const DEFAULT_DISCOVER_CONFIG_URL =
  "https://lawrenceching.github.io/SMM/config.json";

const DISCOVER_TIMEOUT_MS = 10_000;

export type MediaDatabaseType = "tmdb" | "tvdb" | "tmdb-asset" | "tvdb-asset";
export type MediaDatabaseAuthorizationMethod = "date-token" | "none";

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

export type ReverseProxyType = "general";

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
  latestVersion?: string;
}

export interface DiscoverResponseBody {
  data?: DiscoverConfig;
  error?: string;
}

const EMPTY_DISCOVER_CONFIG: DiscoverConfig = {
  mediaDatabases: [],
  reverseProxies: [],
};

function resolveDiscoverConfigUrl(): { url: string; urlFromEnv: boolean } {
  const fromEnv = process.env.EXTERNAL_CONFIG_FILE_URL?.trim();
  if (fromEnv) {
    return { url: fromEnv, urlFromEnv: true };
  }
  return { url: DEFAULT_DISCOVER_CONFIG_URL, urlFromEnv: false };
}

function normalizeAuthorizationMethod(
  value: unknown,
): MediaDatabaseAuthorizationMethod {
  if (typeof value !== "string") return "none";
  if (value === "date-token") return "date-token";
  return "none";
}

function normalizeMediaDatabaseEntry(
  entry: RemoteMediaDatabaseEntry,
): MediaDatabaseEntry | null {
  const endpointUrl = (entry.baseUrl ?? entry.url ?? "").trim();
  if (!endpointUrl) return null;

  const type = entry.type;
  if (
    type !== "tmdb" &&
    type !== "tvdb" &&
    type !== "tmdb-asset" &&
    type !== "tvdb-asset"
  ) {
    return null;
  }

  return {
    type,
    url: endpointUrl,
    authorizationMethod: normalizeAuthorizationMethod(entry.authorizationMethod),
  };
}

function normalizeReverseProxyEntry(
  entry: RemoteReverseProxyEntry,
): ReverseProxyEntry | null {
  const id = (entry.id ?? "").trim();
  const url = (entry.url ?? "").trim();
  if (!id || !url) return null;

  const type = entry.type;
  if (type !== "general") return null;

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
    if (!raw || typeof raw !== "object") continue;
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
    if (!raw || typeof raw !== "object") continue;
    const entry = normalizeReverseProxyEntry(raw as RemoteReverseProxyEntry);
    if (entry) normalized.push(entry);
  }
  return normalized;
}

function normalizeLatestVersion(
  value: unknown,
): { latestVersion?: string; invalidReason?: string } {
  if (value === undefined || value === null) {
    return {};
  }
  if (typeof value !== "string") {
    return { invalidReason: `expected string, got ${typeof value}` };
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { invalidReason: "blank string" };
  }
  return { latestVersion: trimmed };
}

function formatFetchError(error: unknown): {
  message: string;
  name?: string;
  cause?: string;
  stack?: string;
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
    stack: error.stack,
  };
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === "AbortError") ||
    (typeof DOMException !== "undefined" &&
      error instanceof DOMException &&
      error.name === "AbortError")
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function readResponseBodyPreview(
  logger: CoreRoutesLogger | undefined,
  response: Response,
): Promise<string | undefined> {
  try {
    const text = await response.text();
    if (!text) return undefined;
    return text.length > 300 ? `${text.slice(0, 300)}…` : text;
  } catch (error) {
    discoverLog(logger, "warn", "failed to read response body for preview", {
      err: formatFetchError(error),
    });
    return undefined;
  }
}

function logEmptyDiscoverResult(
  logger: CoreRoutesLogger | undefined,
  url: string,
  durationMs: number,
  body: Record<string, unknown>,
  mediaDatabases: MediaDatabaseEntry[],
  latestVersion: string | undefined,
): void {
  const rawMediaDatabasesCount = Array.isArray(body.mediaDatabases)
    ? body.mediaDatabases.length
    : null;
  const rawReverseProxiesCount = Array.isArray(body.reverseProxies)
    ? body.reverseProxies.length
    : null;

  const common = {
    url,
    durationMs,
    latestVersion,
    hasLatestVersionField: "latestVersion" in body,
    rawReverseProxiesCount,
  };

  if (rawMediaDatabasesCount === null) {
    discoverLog(logger, "warn", "remote config missing mediaDatabases array", {
      ...common,
      hasMediaDatabasesField: false,
    });
    return;
  }

  if (rawMediaDatabasesCount === 0) {
    discoverLog(logger, "warn", "remote config has empty mediaDatabases array", {
      ...common,
      rawMediaDatabasesCount,
    });
    return;
  }

  if (mediaDatabases.length === 0) {
    discoverLog(
      logger,
      "warn",
      "remote config mediaDatabases entries were all filtered out during normalization",
      {
        ...common,
        rawMediaDatabasesCount,
        normalizedMediaDatabasesCount: 0,
      },
    );
  }
}

export type FetchDiscoverConfigOptions = Pick<
  CoreRoutesConfig,
  "logger" | "fetchImpl"
>;

/**
 * Fetch and normalize the remote discovery config.
 * Returns empty lists on any error so the UI can gracefully fall back.
 */
export async function doFetchDiscoverConfig(
  config: FetchDiscoverConfigOptions = {},
): Promise<DiscoverConfig> {
  const { logger, fetchImpl = fetch } = config;
  const { url, urlFromEnv } = resolveDiscoverConfigUrl();
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DISCOVER_TIMEOUT_MS);

  discoverLog(logger, "info", "fetching remote config", {
    url,
    urlFromEnv,
    timeoutMs: DISCOVER_TIMEOUT_MS,
    method: "GET",
  });

  try {
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: "GET",
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
    } catch (fetchError) {
      const durationMs = Date.now() - startedAt;
      const aborted = isAbortError(fetchError) || controller.signal.aborted;
      discoverLog(
        logger,
        "error",
        aborted
          ? "remote config fetch aborted (timeout or cancellation)"
          : "failed to fetch remote config",
        {
          url,
          urlFromEnv,
          durationMs,
          aborted,
          signalAborted: controller.signal.aborted,
          timedOut: aborted && durationMs >= DISCOVER_TIMEOUT_MS - 50,
          err: formatFetchError(fetchError),
        },
      );
      return { ...EMPTY_DISCOVER_CONFIG };
    }

    const durationMs = Date.now() - startedAt;
    discoverLog(logger, "info", "remote config HTTP response", {
      url,
      urlFromEnv,
      durationMs,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get("content-type"),
      redirected: response.redirected,
      responseUrl: response.url,
    });

    if (!response.ok) {
      const bodyPreview = await readResponseBodyPreview(logger, response);
      discoverLog(logger, "error", "remote config returned non-OK status", {
        url,
        urlFromEnv,
        durationMs,
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get("content-type"),
        bodyPreview,
      });
      return { ...EMPTY_DISCOVER_CONFIG };
    }

    let rawJson: unknown;
    try {
      rawJson = await response.json();
    } catch (parseError) {
      discoverLog(logger, "error", "remote config response is not valid JSON", {
        url,
        urlFromEnv,
        durationMs,
        contentType: response.headers.get("content-type"),
        err: formatFetchError(parseError),
      });
      return { ...EMPTY_DISCOVER_CONFIG };
    }

    if (!isPlainObject(rawJson)) {
      discoverLog(logger, "error", "remote config JSON root is not an object", {
        url,
        urlFromEnv,
        durationMs,
        rootType:
          rawJson === null
            ? "null"
            : Array.isArray(rawJson)
              ? "array"
              : typeof rawJson,
      });
      return { ...EMPTY_DISCOVER_CONFIG };
    }

    let mediaDatabases: MediaDatabaseEntry[];
    let reverseProxies: ReverseProxyEntry[];
    let latestVersion: string | undefined;
    try {
      mediaDatabases = normalizeMediaDatabases(rawJson.mediaDatabases);
      reverseProxies = normalizeReverseProxies(rawJson.reverseProxies);
      const versionResult = normalizeLatestVersion(rawJson.latestVersion);
      if (versionResult.invalidReason) {
        discoverLog(logger, "warn", "remote config latestVersion ignored", {
          url,
          reason: versionResult.invalidReason,
          rawType: typeof rawJson.latestVersion,
        });
      }
      latestVersion = versionResult.latestVersion;
    } catch (normalizeError) {
      discoverLog(logger, "error", "failed to normalize remote config", {
        url,
        urlFromEnv,
        durationMs,
        err: formatFetchError(normalizeError),
      });
      return { ...EMPTY_DISCOVER_CONFIG };
    }

    if (mediaDatabases.length === 0) {
      logEmptyDiscoverResult(
        logger,
        url,
        durationMs,
        rawJson,
        mediaDatabases,
        latestVersion,
      );
    } else {
      discoverLog(logger, "info", "remote config loaded", {
        url,
        urlFromEnv,
        durationMs,
        mediaDatabasesCount: mediaDatabases.length,
        reverseProxiesCount: reverseProxies.length,
        mediaDatabaseTypes: [
          ...new Set(mediaDatabases.map((entry) => entry.type)),
        ],
        latestVersion,
        hasLatestVersionField: "latestVersion" in rawJson,
      });
    }

    return { mediaDatabases, reverseProxies, latestVersion };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    discoverLog(logger, "error", "unexpected error while loading remote config", {
      url,
      urlFromEnv,
      durationMs,
      signalAborted: controller.signal.aborted,
      err: formatFetchError(error),
    });
    return { ...EMPTY_DISCOVER_CONFIG };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch and normalize the remote media database config.
 * Returns an empty list on any error so the UI can gracefully fall back.
 */
export async function doFetchDiscoveredMediaDatabases(
  config: FetchDiscoverConfigOptions = {},
): Promise<MediaDatabaseEntry[]> {
  const discoverConfig = await doFetchDiscoverConfig(config);
  return discoverConfig.mediaDatabases;
}

export { EMPTY_DISCOVER_CONFIG, DEFAULT_DISCOVER_CONFIG_URL, DISCOVER_TIMEOUT_MS };
