import { Hono } from 'hono';
import { requestId } from 'hono/request-id';
import { cors } from 'hono/cors';
import type { CoreRoutesAuthConfig, CoreRoutesLogger } from '@smm/core-routes';
import { isRequestAuthorized } from '@smm/core-routes';
import { getFoldersRoute } from './src/route/GetFolders';
import { commandExecutionStatusRoute } from './src/route/commandExecutionStatus';

export interface CreateAppDeps {
  auth?: CoreRoutesAuthConfig;
  logger: CoreRoutesLogger;
}

export function createApp(deps: CreateAppDeps) {
  const app = new Hono();

  app.use(requestId());

  // Pino logging middleware for Hono
  app.use(async (c, next) => {
    const reqId = c.get('requestId');
    const method = c.req.method;
    const path = c.req.path;

    // Skip logging for Socket.IO polling to reduce noise
    if (path.includes('/socket.io/')) {
      return next();
    }

    const start = Date.now();

    deps.logger.debug({ requestId: reqId, method, path }, 'incoming request');

    await next();

    const duration = Date.now() - start;
    const status = c.res.status;

    deps.logger.info({
      requestId: reqId,
      method,
      path,
      status,
      duration: `${duration}ms`
    }, 'request completed');
  });

  // Allow browser dev (Vite on another origin) to call CLI directly for streaming APIs.
  app.use(
    '/api/*',
    cors({
      origin: '*',
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Timeout', 'X-Command-Execution-Id'],
      exposeHeaders: [
        'X-Command-Execution-Id',
        'X-Command-Log-Path',
        'X-Resolved-Executable-Path',
      ],
    }),
  );

  // Enforce no browser caching on all API responses, except handlers
  // that explicitly opt into caching (e.g. /api/image poster proxy).
  app.use('/api/*', async (c, next) => {
    await next();
    // Leave CORS preflight responses untouched so browsers can still cache them.
    if (c.req.method === 'OPTIONS') return;
    const cacheControl = c.res.headers.get('Cache-Control');
    const allowsCaching =
      cacheControl && /\b(public|private|max-age|s-maxage|immutable)\b/.test(cacheControl);
    if (!allowsCaching) {
      c.res.headers.set('Cache-Control', 'no-store');
    }
  });

  app.use('/api/*', async (c, next) => {
    if (c.req.method === 'OPTIONS') {
      return next();
    }
    // /api/log is intentionally public: it is write-only, rate-limited
    // (10/s + 200-entry cap), and body-bounded (~800KB max). The flusher
    // uses sendBeacon as its primary path, which cannot carry an
    // Authorization header, so auth would defeat the whole pipeline.
    // Abuse ceiling is "polluted logs" — no read access, no data leak.
    if (c.req.path === '/api/log') {
      return next();
    }
    if (!isRequestAuthorized(c.req.header('Authorization'), deps.auth)) {
      return c.json({ error: 'Unauthorized: invalid or missing token' }, 401);
    }
    return next();
  });

  return app.route('/', getFoldersRoute).route('/', commandExecutionStatusRoute);
}

export type AppType = ReturnType<typeof createApp>;
