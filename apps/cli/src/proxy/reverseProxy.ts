import { logger } from '../../lib/logger';
import { getUserConfig } from '@/utils/config';

export const PORT_RANGE_START = 30000;
export const PORT_RANGE_END = 31000;

export const ALLOWED_UPSTREAM_HOSTS = new Set([
  'api.themoviedb.org',
  'api4.thetvdb.com',
  // SMM-managed default upstream that hosts the public TMDB/TVDB proxy without requiring an API key.
  'tmdb-mcp-server.imlc.me',
  'httpbin.io',
  // AI Provider hosts for summarize feature
  'api.deepseek.com',
  'api.openai.com',
  'openrouter.ai',
  'open.bigmodel.cn',
]);

const HOP_BY_HOP_REQUEST_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

const HOP_BY_HOP_RESPONSE_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-length',
  'content-encoding',
]);

const PROXY_CONTROL_HEADERS = new Set([
  'x-smm-proxy-upstream-baseurl',
]);

export function buildUpstreamUrl(upstreamBaseURL: string, incomingPath: string, incomingSearch: string): string {
  const base = new URL(upstreamBaseURL);
  const basePath = base.pathname.replace(/\/+$/, '');
  const normalizedPath = incomingPath.startsWith('/') ? incomingPath : `/${incomingPath}`;
  const path = `${basePath}${normalizedPath}`;
  const query = incomingSearch.startsWith('?') ? incomingSearch : '';
  return `${base.origin}${path}${query}`;
}

export function validateUpstreamBaseURL(headerValue: string): URL {
  let upstreamUrl: URL;
  try {
    upstreamUrl = new URL(headerValue);
  } catch {
    throw new Error(`Invalid upstream base URL: "${headerValue}"`);
  }
  if (upstreamUrl.protocol !== 'https:' && upstreamUrl.protocol !== 'http:') {
    throw new Error(`Upstream base URL must use http or https protocol, got: "${upstreamUrl.protocol}"`);
  }
  if (!ALLOWED_UPSTREAM_HOSTS.has(upstreamUrl.hostname)) {
    throw new Error(
      `Upstream host "${upstreamUrl.hostname}" is not allowed. Allowed hosts: ${[...ALLOWED_UPSTREAM_HOSTS].join(', ')}`,
    );
  }
  return upstreamUrl;
}

export function filterRequestHeaders(request: Request, upstreamUrl: URL): Headers {
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (HOP_BY_HOP_REQUEST_HEADERS.has(lowerKey)) return;
    if (PROXY_CONTROL_HEADERS.has(lowerKey)) return;
    headers.set(key, value);
  });
  headers.set('Host', upstreamUrl.host);
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
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400',
  };
}

function applyCors(response: Response): Response {
  const headers = new Headers(response.headers);
  const cors = corsHeaders();
  for (const [key, value] of Object.entries(cors)) {
    if (!headers.has(key)) {
      headers.set(key, value);
    }
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function handleProxyRequest(request: Request): Promise<Response> {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const upstreamBaseURL = request.headers.get('X-SMM-Proxy-Upstream-BaseURL');
  if (!upstreamBaseURL) {
    return applyCors(new Response(
      JSON.stringify({ error: 'Missing X-SMM-Proxy-Upstream-BaseURL header' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    ));
  }

  let upstreamUrl: URL;
  try {
    upstreamUrl = validateUpstreamBaseURL(upstreamBaseURL);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid upstream base URL';
    return applyCors(new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    ));
  }

  const incomingUrl = new URL(request.url);
  const forwardUrl = buildUpstreamUrl(upstreamBaseURL, incomingUrl.pathname, incomingUrl.search);

  try {
    const reqHeaders = filterRequestHeaders(request, upstreamUrl);
    const method = request.method;

    const upstreamReq = new Request(forwardUrl, {
      method,
      headers: reqHeaders,
      body: method !== 'GET' && method !== 'HEAD' ? request.body : undefined,
    });

    logger.info(
      { method, forwardUrl, upstreamHost: upstreamUrl.host },
      '[Reverse Proxy] forwarding request',
    );

    const response = await fetch(upstreamReq);
    const respHeaders = filterResponseHeaders(response);
    const respBody = await response.arrayBuffer();

    logger.info(
      { method, forwardUrl, status: response.status, responseBytes: respBody.byteLength },
      '[Reverse Proxy] upstream response',
    );

    return applyCors(new Response(respBody, {
      status: response.status,
      statusText: response.statusText,
      headers: respHeaders,
    }));
  } catch (error) {
    logger.error(
      { err: error, method: request.method, forwardUrl },
      '[Reverse Proxy] upstream request failed',
    );
    return applyCors(new Response(
      JSON.stringify({ error: 'Failed to proxy request to upstream' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    ));
  }
}

export interface ReverseProxyManager {
  /** The base URL of the running proxy (e.g. http://127.0.0.1:30001), or null if not started. */
  readonly url: string | null;
  start(): Promise<void>;
  stop(): void;
}

export function createReverseProxyManager(): ReverseProxyManager {
  let server: ReturnType<typeof Bun.serve> | null = null;
  let currentUrl: string | null = null;

  async function findAvailablePort(reservedPorts: Set<number>): Promise<number> {
    for (let port = PORT_RANGE_START; port <= PORT_RANGE_END; port++) {
      if (reservedPorts.has(port)) {
        continue;
      }
      try {
        const testServer = Bun.serve({
          port,
          hostname: '127.0.0.1',
          fetch() {
            return new Response('ok');
          },
        });
        testServer.stop();
        return port;
      } catch {
        // Port is in use, try the next one
      }
    }
    throw new Error(
      `Could not find an available port in range ${PORT_RANGE_START}-${PORT_RANGE_END}`,
    );
  }

  return {
    get url() {
      return currentUrl;
    },

    async start() {
      if (server) {
        logger.warn('Reverse proxy is already running.');
        return;
      }

      let port: number;
      try {
        const reservedPorts = new Set<number>();
        try {
          const userConfig = await getUserConfig();
          const configuredMcpPort = Number(userConfig.mcpPort ?? 30001);
          if (Number.isFinite(configuredMcpPort)) {
            reservedPorts.add(configuredMcpPort);
          }

          // Add AI provider hosts from user config to the whitelist
          if (userConfig.aiProviders?.length) {
            for (const p of userConfig.aiProviders) {
              if (p.baseURL) {
                try {
                  const url = new URL(p.baseURL);
                  ALLOWED_UPSTREAM_HOSTS.add(url.hostname);
                  logger.info(`[Reverse Proxy] Added AI provider host to whitelist: ${url.hostname}`);
                } catch {
                  logger.warn({ baseURL: p.baseURL }, 'Invalid baseURL in AI provider config');
                }
              }
            }
          }
        } catch (err) {
          logger.warn({ err }, 'Failed to load user config for reverse proxy reserved ports');
        }
        port = await findAvailablePort(reservedPorts);
      } catch (error) {
        logger.error({ err: error }, 'Failed to find available port for reverse proxy');
        currentUrl = null;
        return;
      }

      server = Bun.serve({
        port,
        hostname: '127.0.0.1',
        fetch: handleProxyRequest,
      });

      currentUrl = `http://127.0.0.1:${port}`;
      logger.info(`[Reverse Proxy] started on ${currentUrl}`);
    },

    stop() {
      if (!server) {
        return;
      }
      server.stop();
      server = null;
      currentUrl = null;
      logger.info('[Reverse Proxy] stopped');
    },
  };
}
