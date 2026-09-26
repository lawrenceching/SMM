import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/bun';
import { getRequestListener } from '@hono/node-server';
import path from 'path';
import { setSocketIOManager } from './src/utils/socketIO.ts';
import { handleRenameEpisodeFile } from './src/route/RenameEpisodeFile';
import { handleValidateRenameOperationsRoute } from './src/route/validateRenameOperations';
import { handleListDrives } from './src/route/ListDrives';
import { handleRenameFilesInMediaMetadata } from '@/route/mediaMetadata/renameFilesInMediaMetadata';
import { handleMatchMediaFilesToEpisodeRequest } from './src/route/ai';
import { handleOpenInFileManagerRequest } from './src/route/OpenInFileManager';
import { handleOpenFile } from './src/route/OpenFile';
import { handleMoveFileToTrash } from './src/route/MoveFileToTrash';
import { handleDebugRequest } from './src/route/Debug';
import { handleDebugRecognizeTaskRoutes } from './src/route/debug/debugRecognizeTask';
import { handleDebugCreateRenameEpisodePlan } from './src/route/debug/debugCreateRenameEpisodePlan';
import { handleDebugGetApplicationContextRoute } from './src/route/debug/debugGetApplicationContext';
import { handleDebugGetMediaMetadataRoute } from './src/route/debug/debugGetMediaMetadata';
import { handleDebugRenameFolderToolRoute } from './src/route/debug/debugRenameFolderTool';
import { handleDebugScrapeToolRoute } from './src/route/debug/debugScrapeTool';
import { handleDebugGetJobToolRoute } from './src/route/debug/debugGetJobTool';
import { handleDebugListFilesToolRoute } from './src/route/debug/debugListFilesTool';
import { handleDebugGetMediaFoldersRoute } from './src/route/debug/debugGetMediaFolders';
import { handleDebugGetEpisodesToolRoute } from './src/route/debug/debugGetEpisodesTool';
import { handleDebugIsFolderExistToolRoute } from './src/route/debug/debugIsFolderExistTool';
import { handleRenameEpisodesPlan } from './src/route/RenameEpisodesPlan';
import { handleRecognizeEpisodesPlan } from './src/route/RecognizeEpisodesPlan';
import { handleTryToRecognizeEpisodes } from './src/route/TryToRecognizeEpisodes';
import { handleGetFolders } from './src/route/GetFolders';
import { handleUnimportFolder } from './src/route/UnimportFolder';
import { handleImportFolder } from './src/route/ImportFolder';
import { handleImportLibrary } from './src/route/ImportLibrary';
import { handleGetJob } from './src/route/GetJob';
import { handleStopJob } from './src/route/StopJob';
import { handleGetJobLog } from './src/route/GetJobLog';
import { handleScrape } from './src/route/Scrape';
import { handleTmdb } from './src/route/Tmdb';
import { handleRecognizeFolder } from './src/route/RecognizeFolder';
import { handleTvdb } from './src/route/Tvdb';
import { handleCoreFetch } from './src/route/CoreFetch';
import { handleShowFolder } from './src/route/ShowFolder';
import { handleFolderMetadata } from './src/route/FolderMetadata';
import { handleGetMetadata } from './src/route/metadata/GetMetadata';
import { handleCreateMetadata } from './src/route/metadata/CreateMetadata';
import { handleSetMetadata } from './src/route/metadata/SetMetadata';
import { handleDeleteMetadata } from './src/route/metadata/DeleteMetadata';
import { handleTencentAsrTranscribe } from './src/route/tencentAsr/Transcribe';
import { handleExecuteCmd } from './src/route/executeCmd';
import { handleDiscoverExecutables } from './src/route/discoverExecutables';
import { registerExecuteRoutes } from './src/route/execute';
import { handleCommandLog } from './src/route/commandLog';
import { handleCommandExecutionStatus } from './src/route/commandExecutionStatus';
import { handleLog } from './src/route/Log';
import { handleSpeedtest } from './src/route/speedtest';
import { handleShutdown, setShutdownRequestIPResolver } from './src/route/shutdown';
import { handleSetWatchedFolder } from './src/route/SetWatchedFolder';
import { applyMcpConfig } from '@/mcp/mcpServerManager';
import { getCore } from '@/core/getCore';
import { getUserConfig } from './src/utils/config.ts';
import { requestId } from 'hono/request-id';
import { logger } from './lib/logger';
import {
  createProxiedFetch,
  createReverseProxyManager,
  createSocketIOManager,
  DEFAULT_ALLOWED_UPSTREAM_HOSTS,
  isCoreRoute,
  isRequestAuthorized,
  resolveHttpBindAddress,
  type CoreRoutesAuthConfig,
  type CoreRoutesLogger,
  type ReverseProxyConfig,
  type ReverseProxyManager,
  type SocketIOManager,
} from '@smm/core-routes';
import { createCliCoreRoutesHandler, type HelloResolverHolder } from './src/coreRoutesServer';
import { buildHelloHttpResponse } from './src/cli/helloHttp';
import type { Server as SocketIOServer } from 'socket.io';
import { initI18n } from './src/i18n/config';
import { getFolderWatcher } from './src/services/folderWatcher';
export interface ServerConfig {
  port?: number;
  root?: string;
  beforeStop?: () => Promise<void>;
  auth?: CoreRoutesAuthConfig;
}

function isExecuteCmdRequest(req: IncomingMessage): boolean {
  const url = req.url?.split('?')[0] ?? '';
  return url === '/api/executeCmd' && req.method === 'POST';
}

function diagHttpTimingEnabled(): boolean {
  return process.env.DIAG_HTTP_TIMING === '1' || process.env.E2E_PLATFORM === 'desktop';
}

/** Desktop e2e only. Compare with Vite `[proxy-timing]` lines to see which side stalled. */
function attachCliHttpTiming(req: IncomingMessage, res: ServerResponse, inflight: { n: number }): void {
  const pathname = req.url?.split('?')[0] ?? '';
  if (!pathname.startsWith('/api/') || pathname === '/api/log') return;

  inflight.n += 1;
  const started = Date.now();
  let settled = false;
  const done = (kind: string) => {
    if (settled) return;
    settled = true;
    inflight.n = Math.max(0, inflight.n - 1);
    console.log(
      `[cli-http] ${kind} ${req.method} ${pathname} dur=${Date.now() - started}ms inflight=${inflight.n}`,
    );
  };

  console.log(`[cli-http] -> ${req.method} ${pathname} inflight=${inflight.n}`);
  res.on('finish', () => done(`<- ${res.statusCode}`));
  res.on('close', () => done('aborted'));
}

function createSocketIOLogger(): CoreRoutesLogger {
  return {
    debug: (obj, msg) => logger.debug(obj, msg),
    info: (obj, msg) => logger.info(obj, msg),
    warn: (obj, msg) => logger.warn(obj, msg),
    error: (obj, msg) => logger.error(obj, msg),
  };
}

export class Server {
  private app: Hono;
  private httpServer: http.Server | null = null;
  private port: number;
  private webUiBindAddress: string;
  private root: string;
  private socketManager: SocketIOManager | null = null;
  private proxyManager: ReverseProxyManager | null = null;
  private beforeStop?: () => Promise<void>;
  private stopping = false;
  private auth?: CoreRoutesAuthConfig;

  constructor(config: ServerConfig = {}) {
    this.port = config.port ?? parseInt(process.env.HTTP_PORT || process.env.PORT || '30000', 10);
    this.webUiBindAddress = resolveHttpBindAddress();
    const rootPath = config.root ?? './public';
    this.root = path.resolve(rootPath);
    this.beforeStop = config.beforeStop;
    this.auth = config.auth;

    this.app = new Hono();
    this.app.use(requestId())

    // Pino logging middleware for Hono
    this.app.use(async (c, next) => {
      const reqId = c.get('requestId');
      const method = c.req.method;
      const path = c.req.path;

      // Skip logging for Socket.IO polling to reduce noise
      if (path.includes('/socket.io/')) {
        return next();
      }

      const start = Date.now();

      logger.debug({ requestId: reqId, method, path }, 'incoming request');

      await next();

      const duration = Date.now() - start;
      const status = c.res.status;

      logger.info({
        requestId: reqId,
        method,
        path,
        status,
        duration: `${duration}ms`
      }, 'request completed');
    });

    this.proxyManager = null;

    this.setupMiddleware();
    this.setupRoutes();

    // Initialize i18n (synchronous in constructor to avoid async constructor issues)
    // The initI18n function is configured with initImmediate: false
    this.initializeI18n();
  }

  private setupMiddleware() {
    // Add logging middleware
    // this.app.use('*', honoLogger());
  }

  /**
   * Initialize i18next with filesystem backend for tool description localization.
   * Must be called before tool registration to ensure translations are available.
   *
   * Note: This is synchronous because initI18n() is configured with initImmediate: false
   */
  private initializeI18n() {
    try {
      initI18n().then(() => {
        logger.info('i18next initialized successfully');
      }).catch((error) => {
        logger.error({ err: error }, 'Failed to initialize i18next, tool descriptions will fall back to English');
      });
    } catch (error) {
      logger.error({ err: error }, 'Failed to initialize i18next, tool descriptions will fall back to English');
      // Continue without i18n - tools will use hard-coded descriptions
    }
  }

  private setupRoutes() {
    // Allow browser dev (Vite on another origin) to call CLI directly for streaming APIs.
    this.app.use(
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
    this.app.use('/api/*', async (c, next) => {
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

    this.app.use('/api/*', async (c, next) => {
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
      if (!isRequestAuthorized(c.req.header('Authorization'), this.auth)) {
        return c.json({ error: 'Unauthorized: invalid or missing token' }, 401);
      }
      return next();
    });

    // Platform-specific CLI routes (not in core-routes — ohos does not reuse these).
    // Shared public APIs are dispatched to createCliCoreRoutesHandler via isCoreRoute.
    handleSetWatchedFolder(this.app);
    handleRenameEpisodeFile(this.app);
    handleValidateRenameOperationsRoute(this.app);
    handleListDrives(this.app);
    handleRenameFilesInMediaMetadata(this.app);
    handleMatchMediaFilesToEpisodeRequest(this.app);
    handleOpenInFileManagerRequest(this.app);
    handleOpenFile(this.app);
    handleMoveFileToTrash(this.app);
    handleDebugRequest(this.app);
    handleDebugRecognizeTaskRoutes(this.app);
    handleDebugCreateRenameEpisodePlan(this.app);
    handleDebugGetApplicationContextRoute(this.app);
    handleDebugGetMediaMetadataRoute(this.app);
    handleDebugRenameFolderToolRoute(this.app);
    handleDebugScrapeToolRoute(this.app);
    handleDebugGetJobToolRoute(this.app);
    handleDebugListFilesToolRoute(this.app);
    handleDebugGetMediaFoldersRoute(this.app);
    handleDebugGetEpisodesToolRoute(this.app);
    handleDebugIsFolderExistToolRoute(this.app);
    handleRenameEpisodesPlan(this.app);
    handleRecognizeEpisodesPlan(this.app);
    handleTryToRecognizeEpisodes(this.app);
    handleGetFolders(this.app);
    handleUnimportFolder(this.app);
    handleImportFolder(this.app);
    handleImportLibrary(this.app);
    handleGetJob(this.app);
    handleStopJob(this.app);
    handleGetJobLog(this.app);
    handleScrape(this.app);
    handleTmdb(this.app);
    handleRecognizeFolder(this.app);
    handleTvdb(this.app);
    handleCoreFetch(this.app);
    handleShowFolder(this.app);
    handleFolderMetadata(this.app);
    handleGetMetadata(this.app);
    handleCreateMetadata(this.app);
    handleSetMetadata(this.app);
    handleDeleteMetadata(this.app);
    handleTencentAsrTranscribe(this.app);
    handleExecuteCmd(this.app);
    handleDiscoverExecutables(this.app);
    handleCommandLog(this.app);
    handleCommandExecutionStatus(this.app);
    handleLog(this.app);
    handleSpeedtest(this.app);
    handleShutdown(this.app);
    // /api/execute is registered in start() once the reverse proxy manager is available.

    // Serve static files from the configured root directory
    // Files will be accessible at the root path (e.g., /index.html serves public/index.html)
    this.app.use('/*', serveStatic({ 
      root: this.root,
      rewriteRequestPath: (path) => path === '/' ? '/index.html' : path,
    }));

    // Fallback for root path
    this.app.get('/', (c) => {
      return c.text('Static file server is running. Access files from the /public directory.');
    });

    // Plain-text 404 bodies (e.g. "404 Not Found") break the UI service worker's JSON parsing.
    this.app.notFound((c) => {
      const p = c.req.path;
      if (p.startsWith('/api/')) {
        logger.warn(
          { method: c.req.method, path: p },
          'Hono notFound: no route matched for /api request (restart CLI after adding routes; check method/path)',
        );
        return c.json(
          {
            error: `Not found: ${c.req.method} ${p}. If you recently updated the app, restart the CLI server.`,
          },
          404,
        );
      }
      return c.text('Not Found', 404);
    });
  }

  async start(): Promise<void> {
    if (this.httpServer) {
      logger.warn('Server is already running.');
      return;
    }

    // Build the reverse proxy config from userConfig (mcpPort reservation +
    // AI provider host allowlist). This must run before listen so that the
    // /api/hello route can read the proxyManager's url.
    const proxyConfig = await buildReverseProxyConfig();
    this.proxyManager = createReverseProxyManager(proxyConfig);
    registerExecuteRoutes(this.app, this.proxyManager);

    const helloHolder: HelloResolverHolder = {
      resolve: () =>
        buildHelloHttpResponse(this.proxyManager?.url ?? null, this.port),
    };
    const coreRoutesHandler = await createCliCoreRoutesHandler(
      this.port,
      helloHolder,
      this.auth,
    );

    // Bun.serve() (MCP on mcpPort) requires Bun's native Response.
    // @hono/node-server replaces globalThis.Response with a wrapper
    // by default; disable that so MCP Streamable HTTP works.
    const honoListener = getRequestListener(this.app.fetch, {
      overrideGlobalObjects: false,
    });
    const diagInflight = { n: 0 };
    const diagHttp = diagHttpTimingEnabled();

    this.httpServer = http.createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = req.url?.split('?')[0] ?? '';
      const method = req.method ?? 'GET';

      if (url.startsWith('/socket.io/')) {
        return;
      }

      if (isExecuteCmdRequest(req)) {
        req.setTimeout(0);
      }

      if (diagHttp) {
        attachCliHttpTiming(req, res, diagInflight);
      }

      setShutdownRequestIPResolver((_req) => ({
        address: req.socket.remoteAddress ?? '127.0.0.1',
      }));

      // Shared public APIs → core-routes; cli-only APIs + static → Hono.
      if (isCoreRoute(method, url)) {
        return coreRoutesHandler(req, res);
      }

      return honoListener(req, res);
    });

    this.socketManager = createSocketIOManager(this.httpServer, {
      logger: createSocketIOLogger(),
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });
    setSocketIOManager(this.socketManager);

    await new Promise<void>((resolve, reject) => {
      this.httpServer!.once('error', (err) => {
        reject(err);
      });
      this.httpServer!.listen(this.port, this.webUiBindAddress, () => resolve());
    });

    logger.info(`📁 Static file root: ${this.root}`);
    logger.info(
      `🚀 HTTP server (static + API) running on http://${this.webUiBindAddress}:${this.port}`,
    );
    logger.info(`🔌 Socket.IO server available at http://localhost:${this.port}/socket.io/`);

    await this.proxyManager.start();

    await applyMcpConfig();

    getCore().runHostSpeedTests().catch((err) =>
      logger.error({ err }, "Failed to run TMDB/TVDB host speed tests"),
    );
  }

  async stop(): Promise<void> {
    if (this.stopping) {
      return;
    }
    this.stopping = true;

    if (this.beforeStop) {
      try {
        await this.beforeStop();
      } catch (error) {
        logger.warn(
          { error: error instanceof Error ? error.message : String(error) },
          'beforeStop hook failed during server shutdown',
        );
      }
    }

    if (!this.httpServer) {
      logger.warn('Server is not running.');
      return;
    }

    await this.proxyManager?.stop();
    getFolderWatcher().stopAllWatching();

    await this.socketManager?.drain();
    await new Promise<void>((resolve, reject) => {
      this.httpServer!.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });

    this.httpServer = null;
    this.socketManager = null;
    setShutdownRequestIPResolver(null);
    logger.info('Server stopped.');
  }

  getApp(): Hono {
    return this.app;
  }

  getIO(): SocketIOServer {
    if (!this.socketManager) {
      throw new Error('Socket.IO is not initialized');
    }
    return this.socketManager.getSocketIOInstance();
  }

  getPort(): number {
    return this.port;
  }

  isRunning(): boolean {
    return this.httpServer !== null;
  }
}

/**
 * Build the reverse proxy config from the current user config:
 * - reservedPorts: the configured MCP server port (default 30001) so the
 *   proxy scan does not collide with it.
 * - resolveAllowedUpstreamHosts: a dynamic resolver that reads the latest
 *   user config on each request to build the allowlist. This ensures that
 *   custom TMDB/TVDB hosts and AI provider hosts are always up-to-date.
 *
 * User config read failures are non-fatal: the proxy will still start with
 * defaults so the rest of the CLI can serve requests.
 */
async function buildReverseProxyConfig(): Promise<ReverseProxyConfig> {
  const reservedPorts = new Set<number>();

  try {
    const userConfig = await getUserConfig();
    const configuredMcpPort = Number(userConfig.mcpPort ?? 30001);
    if (Number.isFinite(configuredMcpPort)) {
      reservedPorts.add(configuredMcpPort);
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to load user config for reverse proxy reserved ports');
  }

  // Dynamic resolver: reads the latest user config on each request
  const resolveAllowedUpstreamHosts = async (): Promise<ReadonlySet<string>> => {
    const allowedUpstreamHosts = new Set<string>(DEFAULT_ALLOWED_UPSTREAM_HOSTS);

    try {
      const userConfig = await getUserConfig();

      // Add AI provider hosts
      if (userConfig.aiProviders?.length) {
        for (const p of userConfig.aiProviders) {
          if (!p.baseURL) continue;
          try {
            allowedUpstreamHosts.add(new URL(p.baseURL).hostname);
          } catch {
            logger.warn({ baseURL: p.baseURL }, 'Invalid baseURL in AI provider config');
          }
        }
      }

      // Add custom TMDB/TVDB hosts
      for (const candidate of [userConfig.tmdb?.host, userConfig.tvdb?.host]) {
        if (!candidate) continue;
        try {
          allowedUpstreamHosts.add(new URL(candidate).hostname);
        } catch {
          logger.warn({ host: candidate }, 'Invalid custom media database host URL');
        }
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to load user config for allowed upstream hosts');
    }

    return allowedUpstreamHosts;
  };

  return {
    reservedPorts,
    resolveAllowedUpstreamHosts,
    logger,
    createProxiedFetch,
  };
}
