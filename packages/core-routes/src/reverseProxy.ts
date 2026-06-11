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
  /** Ports to skip during port scanning (e.g. the MCP server port). */
  reservedPorts?: ReadonlySet<number>;
  /** Port range to scan. Defaults to [30000, 31000]. */
  portRange?: { start: number; end: number };
  logger?: ReverseProxyLogger;
  /**
   * Custom `fetch` implementation, used for tests. Defaults to the global
   * `fetch` (Node 18+ / Bun).
   */
  fetchImpl?: typeof fetch;
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
  const headers = new Headers(init.headers);
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
  const allowedUpstreamHosts =
    config.allowedUpstreamHosts ?? DEFAULT_ALLOWED_UPSTREAM_HOSTS;
  const fetchImpl = config.fetchImpl ?? fetch;

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const upstreamBaseURL = request.headers.get("X-SMM-Proxy-Upstream-BaseURL");
  if (!upstreamBaseURL) {
    return applyCorsToBody(
      JSON.stringify({ error: "Missing X-SMM-Proxy-Upstream-BaseURL header" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  let upstreamUrl: URL;
  try {
    upstreamUrl = validateUpstreamBaseURL(upstreamBaseURL, allowedUpstreamHosts);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid upstream base URL";
    return applyCorsToBody(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const incomingUrl = new URL(request.url);
  const forwardUrl = buildUpstreamUrl(
    upstreamBaseURL,
    incomingUrl.pathname,
    incomingUrl.search,
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
      { method, forwardUrl, upstreamHost: upstreamUrl.host },
      "[Reverse Proxy] forwarding request",
    );

    const response = await fetchImpl(upstreamReq);
    const respHeaders = filterResponseHeaders(response);
    const respBody = await response.arrayBuffer();

    logger.info(
      {
        method,
        forwardUrl,
        status: response.status,
        responseBytes: respBody.byteLength,
      },
      "[Reverse Proxy] upstream response",
    );

    return applyCorsToBody(respBody, {
      status: response.status,
      statusText: response.statusText,
      headers: respHeaders,
    });
  } catch (error) {
    logger.error(
      { err: error, method: request.method, forwardUrl },
      "[Reverse Proxy] upstream request failed",
    );
    return applyCorsToBody(
      JSON.stringify({ error: "Failed to proxy request to upstream" }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
}
