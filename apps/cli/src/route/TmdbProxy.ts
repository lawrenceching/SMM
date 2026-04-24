import type { Context, Hono } from 'hono';
import { logger } from '../../lib/logger';

const SMM_PROXY_BASE_URL = 'https://tmdb-mcp-server.imlc.me/api/tmdb';

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

const FORWARDED_HEADER_ALLOWLIST = new Set([
  'accept',
  'accept-language',
  'content-type',
  'if-none-match',
  'if-modified-since',
  'range',
]);

const RESPONSE_HEADER_BLOCKLIST = new Set(['content-length', 'transfer-encoding', 'content-encoding']);
const TMDB_PROXY_TIMEOUT_MS = 15000;
const TMDB_PROXY_MAX_RESPONSE_BYTES = 10 * 1024 * 1024;

function summarizeError(error: unknown) {
  if (!(error instanceof Error)) {
    return { type: typeof error, value: String(error) };
  }

  const cause = error.cause;
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    cause:
      cause && typeof cause === 'object'
        ? {
            ...(cause as Record<string, unknown>),
          }
        : cause,
    code: (error as Error & { code?: unknown }).code,
    errno: (error as Error & { errno?: unknown }).errno,
  };
}

export function getUpstreamPath(c: Context): string {
  const url = new URL(c.req.url);
  const pathnameWithoutPrefix = url.pathname.replace(/^\/tmdb(?=\/|$)/, '') || '/';
  return `${pathnameWithoutPrefix}${url.search}`;
}

export function handleTmdbProxy(app: Hono) {
  app.all('/tmdb/*', async (c) => {
    const xTmdbHost = c.req.header('X-TMDB-Host');
    const xTmdbApiKey = c.req.header('X-TMDB-API-Key');
    const upstreamPath = getUpstreamPath(c);

    let upstreamUrl: string;
    if (xTmdbHost) {
      const normalizedHost = xTmdbHost.replace(/\/+$/, '').replace(/\/3\/?$/, '');
      upstreamUrl = `${normalizedHost}/3${upstreamPath}`;
    } else {
      upstreamUrl = `${SMM_PROXY_BASE_URL}${upstreamPath}`;
    }

    const headers = new Headers();
    c.req.raw.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey === 'x-tmdb-host' ||
        lowerKey === 'x-tmdb-api-key' ||
        HOP_BY_HOP.has(lowerKey) ||
        !FORWARDED_HEADER_ALLOWLIST.has(lowerKey)
      ) {
        return;
      }
      headers.set(key, value);
    });

    if (xTmdbApiKey) {
      headers.set('Authorization', `Bearer ${xTmdbApiKey}`);
    }

    try {
      const method = c.req.method;
      const hasAuthorization = headers.has('Authorization');
      const proxyEnv = {
        HTTP_PROXY: process.env.HTTP_PROXY,
        HTTPS_PROXY: process.env.HTTPS_PROXY,
        NO_PROXY: process.env.NO_PROXY,
      };
      const timeoutSignal = AbortSignal.timeout(TMDB_PROXY_TIMEOUT_MS);
      const upstreamReq = new Request(upstreamUrl, {
        method,
        headers,
        body: method !== 'GET' && method !== 'HEAD' ? c.req.raw.body : undefined,
        signal: timeoutSignal,
      });

      logger.info(
        {
          method,
          upstreamUrl,
          upstreamMode: xTmdbHost ? 'direct-host' : 'smm-proxy',
          upstreamHost: new URL(upstreamUrl).host,
          hasAuthorization,
          requestHeaderKeys: [...headers.keys()],
          proxyEnv,
        },
        '[TMDB Proxy] outgoing request',
      );
      const response = await fetch(upstreamReq);
      const contentLengthHeader = response.headers.get('content-length');
      const contentLength = contentLengthHeader ? Number(contentLengthHeader) : undefined;
      if (
        Number.isFinite(contentLength) &&
        contentLength !== undefined &&
        contentLength > TMDB_PROXY_MAX_RESPONSE_BYTES
      ) {
        logger.warn(
          {
            method,
            upstreamUrl,
            status: response.status,
            contentLength,
            maxResponseBytes: TMDB_PROXY_MAX_RESPONSE_BYTES,
          },
          '[TMDB Proxy] upstream response too large (content-length)',
        );
        return new Response(JSON.stringify({ error: 'Upstream TMDB response too large' }), {
          status: 413,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const responseBuffer = await response.arrayBuffer();
      if (responseBuffer.byteLength > TMDB_PROXY_MAX_RESPONSE_BYTES) {
        logger.warn(
          {
            method,
            upstreamUrl,
            status: response.status,
            responseBytes: responseBuffer.byteLength,
            maxResponseBytes: TMDB_PROXY_MAX_RESPONSE_BYTES,
          },
          '[TMDB Proxy] upstream response too large (buffer)',
        );
        return new Response(JSON.stringify({ error: 'Upstream TMDB response too large' }), {
          status: 413,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const responseHeaders = new Headers(response.headers);
      RESPONSE_HEADER_BLOCKLIST.forEach((header) => responseHeaders.delete(header));

      if (!response.ok) {
        const responsePreview = new TextDecoder().decode(responseBuffer.slice(0, 300));
        logger.warn(
          {
            method,
            upstreamUrl,
            status: response.status,
            statusText: response.statusText,
            contentType: response.headers.get('content-type'),
            responseBytes: responseBuffer.byteLength,
            responsePreview,
          },
          '[TMDB Proxy] upstream non-2xx response',
        );
      } else {
        logger.info(
          {
            method,
            upstreamUrl,
            status: response.status,
            contentType: response.headers.get('content-type'),
            responseBytes: responseBuffer.byteLength,
          },
          '[TMDB Proxy] upstream response',
        );
      }

      return new Response(responseBuffer, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        logger.error(
          {
            method: c.req.method,
            upstreamUrl,
            timeoutMs: TMDB_PROXY_TIMEOUT_MS,
            error: summarizeError(error),
          },
          'TMDB proxy timeout',
        );
        return new Response(JSON.stringify({ error: 'TMDB upstream timeout' }), {
          status: 504,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      logger.error(
        {
          method: c.req.method,
          upstreamUrl,
          error: summarizeError(error),
        },
        'TMDB proxy error',
      );
      return new Response(JSON.stringify({ error: 'Failed to proxy TMDB request' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  });
}
