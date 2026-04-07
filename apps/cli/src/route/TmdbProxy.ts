import type { Context, Hono } from 'hono';
import { proxy } from 'hono/proxy';
import { logger, logHttpReqOut, logHttpRespIn } from '../../lib/logger';
import { tmdbOutboundFetch } from '@/utils/tmdbOutboundFetch';

// const TMDB_UPSTREAM_ORIGIN = 'https://api.themoviedb.org';
const TMDB_UPSTREAM_ORIGIN = 'https://tmdb-mcp-server.imlc.me/api/tmdb';

function upstreamPathFromIncomingUrl(url: URL): string {
  const pathname = url.pathname;
  if (pathname === '/tmdb' || pathname === '/tmdb/') {
    return '/';
  }
  if (pathname.startsWith('/tmdb/')) {
    const rest = pathname.slice('/tmdb'.length);
    return rest === '' ? '/' : rest;
  }
  return pathname;
}

async function forwardTmdbProxy(c: Context) {
  try {
    const url = new URL(c.req.url);
    const path = upstreamPathFromIncomingUrl(url);
    const target = `${TMDB_UPSTREAM_ORIGIN}${path}${url.search}`;
    logHttpReqOut(target, c.req.method);
    const response = await proxy(target, {
      raw: c.req.raw,
      customFetch: (request) => tmdbOutboundFetch(request),
    });
    if (logger.isLevelEnabled('debug')) {
      const text = await response.clone().text();
      let body: unknown = text;
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        /* keep raw text */
      }
      logHttpRespIn(target, response.status, body);
    } else {
      logHttpRespIn(target, response.status);
    }
    return response;
  } catch (err) {
    logger.error({ err }, 'TmdbProxy: upstream fetch failed');
    return c.json({ error: 'Bad gateway' }, 502);
  }
}

export function handleTmdbProxy(app: Hono) {
  app.all('/tmdb', forwardTmdbProxy);
  app.all('/tmdb/*', forwardTmdbProxy);
}
