import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/bun';
import { getRequestListener } from '@hono/node-server';
import path from 'path';
import { setSocketIOManager, acknowledge } from './src/utils/socketIO.ts';
import { handleChatRequest as handleChatRequestCoreRoutes } from './src/route/chatRoute';
import { handleReadFile } from './src/route/ReadFile';
import { createAIProvider } from './lib/ai-provider.ts';
import { getAppDataDir, getUserConfig } from './src/utils/config.ts';
import { handleIsFolderAvailable } from './src/route/IsFolderAvailable';
import { handleWriteFile } from './src/route/WriteFile';
import { handleRenameFiles } from './src/route/RenameFiles';
import { handleRenameFolder } from './src/route/RenameFolder';
import { handleGetEpisodesRoute } from './src/route/getEpisodes';
import { handleListFilesInMediaFolderRoute } from './src/route/listFilesInMediaFolder';
import { handleValidateRenameOperationsRoute } from './src/route/validateRenameOperations';
import { handleReadImage } from './src/route/ReadImage';
import { handleListFiles } from './src/route/ListFiles';
import { handleListDrives } from './src/route/ListDrives';
import { handleDownloadImage } from './src/route/DownloadImage';
import { handleReadMediaMetadata } from '@/route/mediaMetadata/read';
import { handleWriteMediaMetadata } from '@/route/mediaMetadata/write';
import { handleRenameFilesInMediaMetadata } from '@/route/mediaMetadata/renameFilesInMediaMetadata';
import { handleMatchMediaFilesToEpisodeRequest } from './src/route/ai';
import { handleDownloadImageAsFileRequest } from './src/route/DownloadImageAsFile';
import { handleOpenInFileManagerRequest } from './src/route/OpenInFileManager';
import { handleOpenFile } from './src/route/OpenFile';
import { handleMoveFileToTrash } from './src/route/MoveFileToTrash';
import { handleDeleteFile } from './src/route/DeleteFile';
import { handleDebugRequest } from './src/route/Debug';
import { handleDebugRecognizeTaskRoutes } from './src/route/debug/debugRecognizeTask';
import { handleDebugRenameFilesTaskRoutes } from './src/route/debug/debugRenameFilesTask';
import { handleDebugGetApplicationContextRoute } from './src/route/debug/debugGetApplicationContext';
import { handleDebugGetMediaMetadataRoute } from './src/route/debug/debugGetMediaMetadata';
import { handleDebugRenameFolderToolRoute } from './src/route/debug/debugRenameFolderTool';
import { handleDebugListFilesToolRoute } from './src/route/debug/debugListFilesTool';
import { handleDebugGetMediaFoldersRoute } from './src/route/debug/debugGetMediaFolders';
import { handleDebugGetEpisodesToolRoute } from './src/route/debug/debugGetEpisodesTool';
import { handleDebugIsFolderExistToolRoute } from './src/route/debug/debugIsFolderExistTool';
import { handlePlans } from './src/route/Plans';
import { handleTencentAsrTranscribe } from './src/route/tencentAsr/Transcribe';
import { handleExecuteCmd } from './src/route/executeCmd';
import { handleDiscoverExecutables } from './src/route/discoverExecutables';
import { registerExecuteRoutes } from './src/route/execute';
import { handleCommandLog } from './src/route/commandLog';
import { handleCommandExecutionStatus } from './src/route/commandExecutionStatus';
import { handleLog } from './src/route/Log';
import { handleMcpRoutes } from './src/route/Mcp';
import { handleSpeedtest } from './src/route/speedtest';
import { handleDiscover } from './src/route/discover';
import { handleShutdown, setShutdownRequestIPResolver } from './src/route/shutdown';
import { applyMcpConfig } from '@/mcp/mcpServerManager';
import { requestId } from 'hono/request-id';
import { logger } from './lib/logger';
import {
  createReverseProxyManager,
  createSocketIOManager,
  DEFAULT_ALLOWED_UPSTREAM_HOSTS,
  type CoreRoutesLogger,
  type ReverseProxyConfig,
  type ReverseProxyManager,
  type SocketIOManager,
} from '@smm/core-routes';
import type { Server as SocketIOServer } from 'socket.io';
import { initI18n } from './src/i18n/config';
import { initializeFolderWatcher, getFolderWatcher } from './src/services/folderWatcher';

export interface ServerConfig {
  port?: number;
  root?: string;
  beforeStop?: () => Promise<void>;
}

function isExecuteCmdRequest(req: IncomingMessage): boolean {
  const url = req.url?.split('?')[0] ?? '';
  return url === '/api/executeCmd' && req.method === 'POST';
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
  private root: string;
  private socketManager: SocketIOManager | null = null;
  private proxyManager: ReverseProxyManager | null = null;
  private beforeStop?: () => Promise<void>;
  private stopping = false;

  constructor(config: ServerConfig = {}) {
    this.port = config.port ?? parseInt(process.env.PORT || '3000');
    const rootPath = config.root ?? './public';
    this.root = path.resolve(rootPath);
    this.beforeStop = config.beforeStop;

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
        allowHeaders: ['Content-Type', 'X-Timeout', 'X-Command-Execution-Id'],
        exposeHeaders: [
          'X-Command-Execution-Id',
          'X-Command-Log-Path',
          'X-Resolved-Executable-Path',
        ],
      }),
    );

    // Register route handlers
    // /api/chat is implemented in @smm/core-routes (post-migration);
    // the Hono shell here is a thin adapter that wires the cli-specific
    // AI provider factory, user-config reader, and Socket.IO helpers.
    handleChatRequestCoreRoutes(this.app, {
      appDataDir: getAppDataDir(),
      logger: createSocketIOLogger(),
      createAIProvider: (userConfig) => createAIProvider(userConfig),
      getUserConfig: () => getUserConfig(),
      acknowledge: (message, timeoutMs) => acknowledge(message as never, timeoutMs),
    });
    handleReadFile(this.app);
    handleIsFolderAvailable(this.app);
    handleWriteFile(this.app);
    handleRenameFiles(this.app);
    handleRenameFolder(this.app);
    handleGetEpisodesRoute(this.app);
    handleListFilesInMediaFolderRoute(this.app);
    handleValidateRenameOperationsRoute(this.app);
    handleReadImage(this.app);
    handleDownloadImage(this.app);
    handleListFiles(this.app);
    handleListDrives(this.app);
    handleReadMediaMetadata(this.app);
    handleWriteMediaMetadata(this.app);
    handleRenameFilesInMediaMetadata(this.app);
    handleMatchMediaFilesToEpisodeRequest(this.app);
    handleDownloadImageAsFileRequest(this.app);
    handleOpenInFileManagerRequest(this.app);
    handleOpenFile(this.app);
    handleMoveFileToTrash(this.app);
    handleDeleteFile(this.app);
    handleDebugRequest(this.app);
    handleDebugRecognizeTaskRoutes(this.app);
    handleDebugRenameFilesTaskRoutes(this.app);
    handleDebugGetApplicationContextRoute(this.app);
    handleDebugGetMediaMetadataRoute(this.app);
    handleDebugRenameFolderToolRoute(this.app);
    handleDebugListFilesToolRoute(this.app);
    handleDebugGetMediaFoldersRoute(this.app);
    handleDebugGetEpisodesToolRoute(this.app);
    handleDebugIsFolderExistToolRoute(this.app);
    handlePlans(this.app);
    handleTencentAsrTranscribe(this.app);
    handleExecuteCmd(this.app);
    handleDiscoverExecutables(this.app);
    handleCommandLog(this.app);
    handleCommandExecutionStatus(this.app);
    handleLog(this.app);
    handleMcpRoutes(this.app);
    handleSpeedtest(this.app);
    handleDiscover(this.app);
    handleShutdown(this.app);
    // /api/hello and /api/execute are registered in start() once the
    // reverse proxy manager is available.

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

    // Bun.serve() (MCP on mcpPort) requires Bun's native Response.
    // @hono/node-server replaces globalThis.Response with a wrapper
    // by default; disable that so MCP Streamable HTTP works.
    const honoListener = getRequestListener(this.app.fetch, {
      overrideGlobalObjects: false,
    });

    this.httpServer = http.createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = req.url?.split('?')[0] ?? '';

      if (url.startsWith('/socket.io/')) {
        return;
      }

      if (isExecuteCmdRequest(req)) {
        req.setTimeout(0);
      }

      setShutdownRequestIPResolver((_req) => ({
        address: req.socket.remoteAddress ?? '127.0.0.1',
      }));

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
      this.httpServer!.once('error', reject);
      this.httpServer!.listen(this.port, () => resolve());
    });

    logger.info(`📁 Static file root: ${this.root}`);
    logger.info(`🚀 Static file server running on http://localhost:${this.port}`);
    logger.info(`🔌 Socket.IO server available at http://localhost:${this.port}/socket.io/`);

    // Start the reverse proxy before MCP config so it's available for metadata operations
    this.proxyManager.start().catch((err) =>
      logger.error({ err }, 'Failed to start reverse proxy'),
    );

    applyMcpConfig().catch((err) => logger.error({ err }, "Failed to apply MCP config on startup"));

    // Initialize folder watcher for all existing media folders
    this.initializeFolderWatcherAsync();
  }

  private async initializeFolderWatcherAsync(): Promise<void> {
    try {
      const userConfig = await getUserConfig();
      const folders = userConfig.folders || [];
      if (folders.length > 0) {
        initializeFolderWatcher(folders);
        logger.info({ folderCount: folders.length }, 'Folder watcher initialized for all media folders');
      } else {
        logger.info('No media folders to watch');
      }
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to initialize folder watcher',
      );
    }
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

    await new Promise<void>((resolve, reject) => {
      this.socketManager?.io.close(() => {
        this.httpServer!.close((err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
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
 * - allowedUpstreamHosts: the SMM defaults plus any AI provider hosts the
 *   user has configured (used by the summarize feature).
 *
 * User config read failures are non-fatal: the proxy will still start with
 * defaults so the rest of the CLI can serve requests.
 */
async function buildReverseProxyConfig(): Promise<ReverseProxyConfig> {
  const reservedPorts = new Set<number>();
  const allowedUpstreamHosts = new Set<string>(DEFAULT_ALLOWED_UPSTREAM_HOSTS);

  try {
    const userConfig = await getUserConfig();
    const configuredMcpPort = Number(userConfig.mcpPort ?? 30001);
    if (Number.isFinite(configuredMcpPort)) {
      reservedPorts.add(configuredMcpPort);
    }

    if (userConfig.aiProviders?.length) {
      for (const p of userConfig.aiProviders) {
        if (!p.baseURL) continue;
        try {
          allowedUpstreamHosts.add(new URL(p.baseURL).hostname);
          logger.info(
            { host: new URL(p.baseURL).hostname },
            '[Reverse Proxy] Added AI provider host to whitelist',
          );
        } catch {
          logger.warn({ baseURL: p.baseURL }, 'Invalid baseURL in AI provider config');
        }
      }
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to load user config for reverse proxy reserved ports');
  }

  return { reservedPorts, allowedUpstreamHosts, logger };
}
