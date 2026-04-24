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
      if (lowerKey === 'x-tmdb-host' || lowerKey === 'x-tmdb-api-key' || HOP_BY_HOP.has(lowerKey)) {
        return;
      }
      headers.set(key, value);
    });

    if (xTmdbApiKey) {
      headers.set('Authorization', `Bearer ${xTmdbApiKey}`);
    }

    try {
      const method = c.req.method;
      const upstreamReq = new Request(upstreamUrl, {
        method,
        headers,
        body: method !== 'GET' && method !== 'HEAD' ? c.req.raw.body : undefined,
      });

      logger.info(`[TMDB Proxy] ${method} ${upstreamUrl}`);
      const response = await fetch(upstreamReq);

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (error) {
      logger.error({ error }, 'TMDB proxy error');
      return new Response(JSON.stringify({ error: 'Failed to proxy TMDB request' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  });
}
