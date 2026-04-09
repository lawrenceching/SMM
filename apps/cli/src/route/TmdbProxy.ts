import type { Context, Hono } from 'hono';
import { proxy } from 'hono/proxy';
import { logger, logHttpReqIn, logHttpReqOut } from '../../lib/logger';

// const TMDB_UPSTREAM_ORIGIN = 'https://api.themoviedb.org';
const TMDB_UPSTREAM_BASE_URL = 'https://tmdb-mcp-server.imlc.me/api/tmdb';

export function getUpstreamPath(c: Context): string {
  const url = new URL(c.req.url);
  const pathnameWithoutPrefix = url.pathname.replace(/^\/tmdb(?=\/|$)/, '') || '/';
  return `${pathnameWithoutPrefix}${url.search}`;
}


export function handleTmdbProxy(app: Hono) {
  // TODO: support TMDB offical host
  app.all('/tmdb/*', (c) => {
    const upstreamPath = getUpstreamPath(c);
    const url = `${TMDB_UPSTREAM_BASE_URL}${upstreamPath}`
    return proxy(url, {
      ...c.req,
      headers: {
        // TODO: pass the User-Agent header to identify SMM version
      },
    })
  });
}
