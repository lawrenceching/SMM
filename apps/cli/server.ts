import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/bun';
import path from 'path';
import { initializeSocketIO } from './src/utils/socketIO.ts';
import { handleChatRequest } from './tasks/ChatTask';
import { handleReadFile } from './src/route/ReadFile';
import { handleWriteFile } from './src/route/WriteFile';
import { handleRenameFiles } from './src/route/RenameFiles';
import { handleRenameFolder } from './src/route/RenameFolder';
import { handleReadImage } from './src/route/ReadImage';
import { handleListFiles } from './src/route/ListFiles';
import { handleListDrives } from './src/route/ListDrives';
import { handleIsFolderAvailable } from './src/route/IsFolderAvailable';
import { handleDownloadImage } from './src/route/DownloadImage';
import { handleReadMediaMetadata } from '@/route/mediaMetadata/read';
import { handleWriteMediaMetadata } from '@/route/mediaMetadata/write';
import { handleDeleteMediaMetadata } from '@/route/mediaMetadata/delete';
import { handleRenameFilesInMediaMetadata } from '@/route/mediaMetadata/renameFilesInMediaMetadata';
import { handleMatchMediaFilesToEpisodeRequest } from './src/route/ai';
import { handleAICheck } from './src/route/AICheck';
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
import { handleGetPendingPlans } from './src/route/GetPendingPlans';
import { handleUpdatePlan } from './src/route/UpdatePlan';
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
import { createReverseProxyManager, type ReverseProxyManager } from '@/proxy/reverseProxy';
import { Server as SocketIOServer } from 'socket.io';
import { Server as Engine } from '@socket.io/bun-engine';
import { initI18n } from './src/i18n/config';
import { initializeFolderWatcher, getFolderWatcher } from './src/services/folderWatcher';
import { getUserConfig } from './src/utils/config';

export interface ServerConfig {
  port?: number;
  root?: string;
  beforeStop?: () => Promise<void>;
}

export class Server {
  private app: Hono;
  private server: ReturnType<typeof Bun.serve> | null = null;
  private port: number;
  private root: string;
  private io: SocketIOServer;
  private engine: Engine;
  private proxyManager: ReverseProxyManager;
  private beforeStop?: () => Promise<void>;
  private stopping = false;

  constructor(config: ServerConfig = {}) {
    this.port = config.port ?? parseInt(process.env.PORT || '3000');
    const rootPath = config.root ?? './public';
    this.root = path.resolve(rootPath);
    this.beforeStop = config.beforeStop;

    // Initialize Socket.IO and Bun Engine with CORS configuration
    this.engine = new Engine({
      cors: {
        origin: "*", // Allow all origins (adjust in production)
        methods: ["GET", "POST"],
        credentials: true
      }
    });

    this.io = new SocketIOServer({
      cors: {
        origin: "*", // Allow all origins (adjust in production)
        methods: ["GET", "POST"]
      }
    });

    this.io.bind(this.engine);

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

    this.proxyManager = createReverseProxyManager();

    this.setupMiddleware();
    this.setupRoutes();

    // Initialize Socket.IO connection handlers
    initializeSocketIO(this.io);

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
    handleChatRequest(this.app);
    handleReadFile(this.app);
    handleWriteFile(this.app);
    handleRenameFiles(this.app);
    handleRenameFolder(this.app);
    handleReadImage(this.app);
    handleDownloadImage(this.app);
    handleListFiles(this.app);
    handleListDrives(this.app);
    handleIsFolderAvailable(this.app);
    handleReadMediaMetadata(this.app);
    handleWriteMediaMetadata(this.app);
    handleDeleteMediaMetadata(this.app);
    handleRenameFilesInMediaMetadata(this.app);
    handleMatchMediaFilesToEpisodeRequest(this.app);
    handleAICheck(this.app);
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
    handleGetPendingPlans(this.app);
    handleUpdatePlan(this.app);
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
    // Register /api/hello and /api/execute routes (extracted for testability).
    registerExecuteRoutes(this.app, this.proxyManager);

    // Socket.IO is handled via engine in Bun.serve, not as a Hono route

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

  start(): void {
    if (this.server) {
      logger.warn('Server is already running.');
      return;
    }

    const { websocket } = this.engine.handler();

    this.server = Bun.serve({
      port: this.port,
      idleTimeout: 30, // must be greater than the "pingInterval" option of the engine, which defaults to 25 seconds
      fetch: (req, server) => {
        setShutdownRequestIPResolver((request) => server.requestIP(request));
        const url = new URL(req.url);

        // Bun applies idleTimeout to streaming bodies: if no bytes are written for idleTimeout
        // seconds, the connection is reset mid-response. executeCmd can be quiet for minutes
        // (e.g. ffmpeg). Disable per-request idle timeout for this route only.
        if (url.pathname === '/api/executeCmd' && req.method === 'POST') {
          server.timeout(req, 0);
        }

        // Handle Socket.IO requests
        if (url.pathname.startsWith('/socket.io/')) {
          return this.engine.handleRequest(req, server);
        } else {
          // Handle regular HTTP requests with Hono
          return this.app.fetch(req, server);
        }
      },
      websocket,
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

    if (!this.server) {
      logger.warn('Server is not running.');
      return;
    }

    this.proxyManager.stop();
    getFolderWatcher().stopAllWatching();
    this.server.stop();
    this.server = null;
    setShutdownRequestIPResolver(null);
    logger.info('Server stopped.');
  }

  getApp(): Hono {
    return this.app;
  }

  getIO(): SocketIOServer {
    return this.io;
  }

  getPort(): number {
    return this.port;
  }

  isRunning(): boolean {
    return this.server !== null;
  }
}
