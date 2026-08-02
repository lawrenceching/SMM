import {
  formatProxyHostForLog,
  getOutboundProxyMode,
  type OutboundProxyMode,
} from "./proxiedFetch.ts";
import type { FetchLike } from "./fetchInput.ts";
import { describeFetchError } from "./downloadImage.ts";

/**
 * Reverse proxy: forwards incoming requests to a whitelisted upstream based on
 * the `X-SMM-Proxy-Upstream-BaseURL` request header.
 *
 * Framework-agnostic: only uses the Web Fetch standard (`Request` / `Response` /
 * `Headers` / `fetch` / `URL`) and Node built-ins (`node:http`, `node:net`).
 * No external dependencies.
 *
 * - Pure Web-Fetch entry point: {@link handleProxyRequest}
 * - Node http integration: see `reverseProxyNode.ts`
 * - Lifecycle manager (port scan + http server): {@link createReverseProxyManager}
 */

export const PORT_RANGE_START = 30000;
export const PORT_RANGE_END = 31000;

/**
 * Default upstream host allowlist. Mirrors the original SMM CLI reverse proxy
 * configuration: TMDB, TVDB, the SMM-managed MCP upstream, httpbin (test) and
 * a few AI provider hosts used by the summarize feature.
 */
export const DEFAULT_ALLOWED_UPSTREAM_HOSTS: ReadonlySet<string> = new Set([
  "api.themoviedb.org",
  "api4.thetvdb.com",
  // SMM-managed default upstream that hosts the public TMDB/TVDB proxy without requiring an API key.
  "mediadb.vercel.app",
  "tmdb-mcp-server.imlc.me",
  "httpbin.io",
  // AI Provider hosts for summarize feature
  "api.deepseek.com",
  "api.openai.com",
  "openrouter.ai",
  "open.bigmodel.cn",
]);

const HOP_BY_HOP_REQUEST_HEADERS: ReadonlySet<string> = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const HOP_BY_HOP_RESPONSE_HEADERS: ReadonlySet<string> = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-length",
  "content-encoding",
]);

/**
 * SMM-specific request header used to instruct the proxy which upstream to
 * forward to. Stripped from the upstream request to prevent leakage.
 */
const PROXY_CONTROL_HEADERS: ReadonlySet<string> = new Set([
  "x-smm-proxy-upstream-baseurl",
  "x-http-proxy",
]);

/** Conditional cache headers — strip when forwarding so upstream returns full 200 bodies. */
const CONDITIONAL_REQUEST_HEADERS: ReadonlySet<string> = new Set([
  "if-none-match",
  "if-modified-since",
  "if-match",
  "if-unmodified-since",
]);

export interface ReverseProxyLogger {
  debug(obj: Record<string, unknown>, msg?: string): void;
  info(obj: Record<string, unknown>, msg?: string): void;
  warn(obj: Record<string, unknown>, msg?: string): void;
  error(obj: Record<string, unknown>, msg?: string): void;
}

export interface ReverseProxyConfig {
  /** Upstream host allowlist. Defaults to {@link DEFAULT_ALLOWED_UPSTREAM_HOSTS}. */
  allowedUpstreamHosts?: ReadonlySet<string>;
  /**
   * Optional callback to dynamically resolve the upstream host allowlist.
   * Called on every request to support runtime configuration changes.
   * Takes precedence over {@link allowedUpstreamHosts} when both are provided.
   */
  resolveAllowedUpstreamHosts?: () => Promise<ReadonlySet<string>>;
  /** Ports to skip during port scanning (e.g. the MCP server port). */
  reservedPorts?: ReadonlySet<number>;
  /** Port range to scan. Defaults to [30000, 31000]. */
  portRange?: { start: number; end: number };
  logger?: ReverseProxyLogger;
  /**
   * Custom `fetch` implementation, used for tests. Defaults to the global
   * `fetch` (Node 18+ / Bun).
   */
  fetchImpl?: FetchLike;

  /**
   * Optional factory to create a proxied `fetch` implementation when the
   * incoming request carries an `X-Http-Proxy` header.
   *
   * The factory receives the proxy URL from the header (e.g.
   * `http://127.0.0.1:8081`) and must return a function matching the `fetch`
   * signature, or `undefined` to fall through to {@link fetchImpl} / global
   * `fetch`.
   *
   * When `X-Http-Proxy` is present and `createProxiedFetch` is set, the
   * returned fetch is used **only for that single request** — subsequent
   * requests without the header use the normal fetch path.
   */
  createProxiedFetch?: (
    proxyUrl: string,
    logger?: ReverseProxyLogger,
  ) => FetchLike | undefined;
}

export function buildUpstreamUrl(
  upstreamBaseURL: string,
  incomingPath: string,
  incomingSearch: string,
): string {
  const base = new URL(upstreamBaseURL);
  const basePath = base.pathname.replace(/\/+$/, "");
  const normalizedPath = incomingPath.startsWith("/") ? incomingPath : `/${incomingPath}`;
  const path = `${basePath}${normalizedPath}`;
  const query = incomingSearch.startsWith("?") ? incomingSearch : "";
  return `${base.origin}${path}${query}`;
}

export function validateUpstreamBaseURL(
  headerValue: string,
  allowedUpstreamHosts: ReadonlySet<string>,
): URL {
  let upstreamUrl: URL;
  try {
    upstreamUrl = new URL(headerValue);
  } catch {
    throw new Error(`Invalid upstream base URL: "${headerValue}"`);
  }
  if (upstreamUrl.protocol !== "https:" && upstreamUrl.protocol !== "http:") {
    throw new Error(
      `Upstream base URL must use http or https protocol, got: "${upstreamUrl.protocol}"`,
    );
  }
  if (!allowedUpstreamHosts.has(upstreamUrl.hostname)) {
    throw new Error(
      `Upstream host "${upstreamUrl.hostname}" is not allowed. Allowed hosts: ${[...allowedUpstreamHosts].join(", ")}`,
    );
  }
  return upstreamUrl;
}

export function filterRequestHeaders(
  request: Request,
  upstreamUrl: URL,
): Headers {
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (HOP_BY_HOP_REQUEST_HEADERS.has(lowerKey)) return;
    if (PROXY_CONTROL_HEADERS.has(lowerKey)) return;
    if (CONDITIONAL_REQUEST_HEADERS.has(lowerKey)) return;
    headers.set(key, value);
  });
  headers.set("Host", upstreamUrl.host);
  return headers;
}

export function filterResponseHeaders(response: Response): Headers {
  const headers = new Headers();
  response.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (HOP_BY_HOP_RESPONSE_HEADERS.has(lowerKey)) return;
    headers.set(key, value);
  });
  return headers;
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "86400",
  };
}

function applyCorsToBody(
  body: ArrayBuffer | string | null,
  init: ResponseInit = {},
): Response {
  const headers = new Headers();
  if (init.headers) {
    const source = init.headers as
      | Headers
      | Record<string, string>
      | Array<[string, string]>;
    if (source instanceof Headers) {
      source.forEach((value, key) => headers.set(key, value));
    } else if (Array.isArray(source)) {
      for (const [key, value] of source) {
        headers.set(key, value);
      }
    } else {
      for (const [key, value] of Object.entries(source)) {
        headers.set(key, value);
      }
    }
  }
  for (const [key, value] of Object.entries(corsHeaders())) {
    if (!headers.has(key)) {
      headers.set(key, value);
    }
  }
  return new Response(body, {
    status: init.status ?? 200,
    statusText: init.statusText,
    headers,
  });
}

function noopLogger(): ReverseProxyLogger {
  return {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  };
}

type ResolvedProxyMode = OutboundProxyMode | "direct" | "direct-fallback";

function buildOutboundProxyLogFields(
  httpProxyHeader: string | null,
  usingProxiedFetch: boolean,
  forwardUrl?: string,
): {
  viaHttpProxy: boolean;
  httpProxyHost?: string;
  proxyMode: ResolvedProxyMode;
} {
  const trimmed = httpProxyHeader?.trim();
  const viaHttpProxy = Boolean(trimmed);
  if (!viaHttpProxy) {
    return { viaHttpProxy: false, proxyMode: "direct" };
  }
  const httpProxyHost = formatProxyHostForLog(trimmed!);
  if (!usingProxiedFetch) {
    return { viaHttpProxy: true, httpProxyHost, proxyMode: "direct-fallback" };
  }
  return {
    viaHttpProxy: true,
    httpProxyHost,
    proxyMode: getOutboundProxyMode(trimmed!, forwardUrl),
  };
}

// ─── Error classification ──────────────────────────────────────────

interface ProxyErrorInfo {
  message: string;
  code: string;
}

const PROXY_ERROR_CODES: Record<string, ProxyErrorInfo> = {
  ENOTFOUND: {
    message: "DNS resolution failed for upstream host",
    code: "DNS_RESOLUTION_FAILED",
  },
  ECONNREFUSED: {
    message: "Connection refused by upstream host",
    code: "CONNECTION_REFUSED",
  },
  ConnectionRefused: {
    message: "Connection refused by upstream host",
    code: "CONNECTION_REFUSED",
  },
  ECONNRESET: {
    message: "Connection was reset by upstream host",
    code: "CONNECTION_RESET",
  },
  ETIMEDOUT: {
    message: "Connection to upstream host timed out",
    code: "CONNECTION_TIMEOUT",
  },
  ENETUNREACH: {
    message: "Upstream network is unreachable",
    code: "NETWORK_UNREACHABLE",
  },
  ECONNABORTED: {
    message: "Connection was aborted",
    code: "CONNECTION_ABORTED",
  },
  UND_ERR_CONNECT_TIMEOUT: {
    message: "Connection to upstream host timed out",
    code: "CONNECTION_TIMEOUT",
  },
  UND_ERR_HEADERS_TIMEOUT: {
    message: "Upstream host did not respond with headers in time",
    code: "HEADERS_TIMEOUT",
  },
};

/** TLS/certificate error codes that are not recoverable. */
const TLS_ERROR_CODES = new Set([
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
]);

/** Extract the original error message and system code for internal logging. */
function extractLoggingErrorDetail(error: unknown): {
  originalError: string;
  systemCode?: string;
  causeMessage?: string;
} {
  if (!(error instanceof Error)) {
    return { originalError: String(error) };
  }

  const originalError = describeFetchError(error);

  let systemCode: string | undefined;
  let causeMessage: string | undefined;

  if (typeof error === "object" && "code" in error) {
    systemCode = String((error as { code: unknown }).code);
  } else if (typeof error === "object" && "errno" in error) {
    systemCode = String((error as { errno: unknown }).errno);
  }

  if (!systemCode) {
    let current: Error = error;
    for (let depth = 0; depth < 3; depth++) {
      const cause = current.cause;
      if (!(cause instanceof Error)) break;
      if (!systemCode) {
        systemCode = (cause as { code?: unknown }).code as string | undefined;
      }
      if (cause.message && cause.message !== error.message) {
        causeMessage = cause.message;
      }
      current = cause;
    }
  }

  return { originalError, systemCode, causeMessage };
}

/** Look up a system error code in the known code/errno maps. */
function lookupSystemCode(code: string): ProxyErrorInfo | undefined {
  if (TLS_ERROR_CODES.has(code)) {
    return { message: "TLS certificate validation failed for upstream host", code: "TLS_ERROR" };
  }
  return PROXY_ERROR_CODES[code];
}

/**
 * Walk the error and its cause chain, returning classified error info.
 *
 * Priority:
 *  1. Known system error code (Node: error.cause.code, Bun: error.code/errno)
 *  2. Proxy-specific message patterns (timeout, CONNECT refused, etc.)
 *  3. Original error message as fallback
 */
function classifyProxyError(error: unknown): ProxyErrorInfo {
  if (!(error instanceof Error)) {
    return { message: String(error), code: "UPSTREAM_REQUEST_FAILED" };
  }

  // Priority 1: walk error chain for a known system code
  let current: unknown = error;
  for (let depth = 0; depth < 3; depth++) {
    if (!(current instanceof Error)) break;

    const causeCode = (current as { code?: unknown }).code;
    if (typeof causeCode === "string") {
      const found = lookupSystemCode(causeCode);
      if (found) return found;
    }

    // Bun fallback: errno instead of code
    if (!causeCode) {
      const causeErrno = (current as { errno?: unknown }).errno;
      if (typeof causeErrno === "string") {
        const found = lookupSystemCode(causeErrno);
        if (found) return found;
      }
    }

    current = current.cause;
  }

  // Priority 2: message-based patterns
  const msg = error.message;
  if (msg.includes("timeout")) {
    return { message: "Proxy request timed out", code: "PROXY_TIMEOUT" };
  }
  if (msg.includes("CONNECT refused")) {
    const statusMatch = msg.match(/HTTP\/\d\.\d\s+(\d+)/);
    return {
      message: statusMatch
        ? `Proxy CONNECT tunnel refused with status ${statusMatch[1]}`
        : "Proxy CONNECT tunnel was refused by the proxy server",
      code: "PROXY_CONNECT_REFUSED",
    };
  }
  if (msg.includes("Unsupported proxy scheme")) {
    return { message: msg, code: "UNSUPPORTED_PROXY_SCHEME" };
  }

  // Priority 3: use the original error message directly
  return { message: error.message, code: "UPSTREAM_REQUEST_FAILED" };
}

// ─── Problem Details (RFC 7807) ────────────────────────────────────

interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
}

function proxyErrorToProblemDetails(
  errInfo: ProxyErrorInfo,
  status: number,
): ProblemDetails {
  return {
    type: "about:blank",
    title: status === 502 ? "Bad Gateway" : status === 400 ? "Bad Request" : "Upstream Error",
    status,
    detail: errInfo.message,
  };
}

/**
 * Pure Web-Fetch entry point. Validate, build upstream URL, forward and pipe
 * back the upstream response with hop-by-hop headers stripped and CORS applied.
 *
 * Decoupled from Node `http`: works with any environment that can produce a
 * `Request` (Bun.serve, Deno, Cloudflare Workers, etc).
 */
export async function handleProxyRequest(
  request: Request,
  config: ReverseProxyConfig = {},
): Promise<Response> {
  const logger = config.logger ?? noopLogger();
  const fetchImpl = config.fetchImpl ?? fetch;

  // Resolve allowlist: prefer dynamic resolver if provided, otherwise use static or default
  let allowedUpstreamHosts: ReadonlySet<string>;
  if (config.resolveAllowedUpstreamHosts) {
    try {
      allowedUpstreamHosts = await config.resolveAllowedUpstreamHosts();
    } catch (error) {
      logger.error(
        { err: error, errorMessage: error instanceof Error ? error.message : String(error) },
        "[Reverse Proxy] failed to resolve allowed upstream hosts, falling back to defaults",
      );
      allowedUpstreamHosts = config.allowedUpstreamHosts ?? DEFAULT_ALLOWED_UPSTREAM_HOSTS;
    }
  } else {
    allowedUpstreamHosts = config.allowedUpstreamHosts ?? DEFAULT_ALLOWED_UPSTREAM_HOSTS;
  }

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  // Read optional X-Http-Proxy header to determine the outbound proxy
  // for this specific request. When set, the reverse proxy forwards the
  // request through the given HTTP proxy instead of connecting directly
  // to the upstream.
  const httpProxyHeader = request.headers.get("X-Http-Proxy");
  let activeFetch = fetchImpl;
  let usingProxiedFetch = false;
  if (httpProxyHeader?.trim() && config.createProxiedFetch) {
    try {
      const proxiedFetch = config.createProxiedFetch(httpProxyHeader, logger);
      if (proxiedFetch) {
        activeFetch = proxiedFetch;
        usingProxiedFetch = true;
      } else {
        logger.warn(
          {
            httpProxyHost: formatProxyHostForLog(httpProxyHeader),
          },
          "[Reverse Proxy] createProxiedFetch returned undefined; using direct fetch",
        );
      }
    } catch (error) {
      logger.error(
        {
          httpProxyHost: formatProxyHostForLog(httpProxyHeader),
          err: error,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
        "[Reverse Proxy] failed to create proxied fetch, falling back to direct",
      );
    }
  } else if (httpProxyHeader?.trim() && !config.createProxiedFetch) {
    logger.warn(
      {
        httpProxyHost: formatProxyHostForLog(httpProxyHeader),
      },
      "[Reverse Proxy] X-Http-Proxy set but createProxiedFetch is not configured; using direct fetch",
    );
  }

  const upstreamBaseURL = request.headers.get("X-SMM-Proxy-Upstream-BaseURL");
  if (!upstreamBaseURL) {
    return applyCorsToBody(
      JSON.stringify({
        type: "about:blank",
        title: "Bad Request",
        status: 400,
        detail: "Missing X-SMM-Proxy-Upstream-BaseURL header",
      }),
      { status: 400, headers: { "Content-Type": "application/problem+json" } },
    );
  }

  let upstreamUrl: URL;
  try {
    upstreamUrl = validateUpstreamBaseURL(upstreamBaseURL, allowedUpstreamHosts);
  } catch (error) {
    return applyCorsToBody(
      JSON.stringify({
        type: "about:blank",
        title: "Bad Request",
        status: 400,
        detail: error instanceof Error ? error.message : "Invalid upstream base URL",
      }),
      { status: 400, headers: { "Content-Type": "application/problem+json" } },
    );
  }

  const incomingUrl = new URL(request.url);
  const forwardUrl = buildUpstreamUrl(
    upstreamBaseURL,
    incomingUrl.pathname,
    incomingUrl.search,
  );
  const proxyLogFields = buildOutboundProxyLogFields(
    httpProxyHeader,
    usingProxiedFetch,
    forwardUrl,
  );

  try {
    const reqHeaders = filterRequestHeaders(request, upstreamUrl);
    const method = request.method;

    const upstreamReq = new Request(forwardUrl, {
      method,
      headers: reqHeaders,
      body: method !== "GET" && method !== "HEAD" ? request.body : undefined,
      // Required by Node's undici when streaming a body
      ...(method !== "GET" && method !== "HEAD" ? { duplex: "half" as const } : {}),
    });

    logger.info(
      {
        method,
        forwardUrl,
        upstreamHost: upstreamUrl.host,
        incomingPath: incomingUrl.pathname,
        upstreamBaseURL,
        ...proxyLogFields,
      },
      "[Reverse Proxy] forwarding request",
    );

    const response = await activeFetch(upstreamReq);
    const respHeaders = filterResponseHeaders(response);
    const respBody = await response.arrayBuffer();

    logger.info(
      {
        method,
        forwardUrl,
        status: response.status,
        responseBytes: respBody.byteLength,
        ...proxyLogFields,
      },
      "[Reverse Proxy] upstream response",
    );

    return applyCorsToBody(respBody, {
      status: response.status,
      statusText: response.statusText,
      headers: respHeaders,
    });
  } catch (error) {
    const errInfo = classifyProxyError(error);
    const errDetail = extractLoggingErrorDetail(error);
    logger.error(
      {
        err: error,
        errorMessage: error instanceof Error ? error.message : String(error),
        originalError: errDetail.originalError,
        systemCode: errDetail.systemCode,
        causeMessage: errDetail.causeMessage,
        method: request.method,
        forwardUrl,
        incomingPath: incomingUrl.pathname,
        upstreamBaseURL,
        ...proxyLogFields,
      },
      "[Reverse Proxy] upstream request failed",
    );
    const problem = proxyErrorToProblemDetails(errInfo, 502);
    return applyCorsToBody(JSON.stringify(problem), {
      status: 502,
      headers: { "Content-Type": "application/problem+json" },
    });
  }
}
