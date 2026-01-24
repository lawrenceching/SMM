import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import path from 'path';
import { z } from 'zod/v3';
import { initializeSocketIO } from './src/utils/socketIO.ts';
import { executeHelloTask } from './tasks/HelloTask';
import { executeGetSelectedMediaMetadataTask } from './tasks/GetSelectedMediaMetadataTask';
import { handleChatRequest } from './tasks/ChatTask';
import { handleReadFile } from './src/route/ReadFile';
import { handleWriteFile } from './src/route/WriteFile';
import { handleRenameFile } from './src/route/RenameFile';
import { handleRenameFolder } from './src/route/RenameFolder';
import { handleNewFileName } from './src/route/NewFileName';
import { handleReadImage } from './src/route/ReadImage';
import { handleListFiles } from './src/route/ListFiles';
import { handleListDrives } from './src/route/ListDrives';
import { handleDownloadImage } from './src/route/DownloadImage';
import { handleReadMediaMetadata } from '@/route/mediaMetadata/read';
import { handleWriteMediaMetadata } from '@/route/mediaMetadata/write';
import { handleDeleteMediaMetadata } from '@/route/mediaMetadata/delete';
import { handleTmdb } from './src/route/Tmdb';
import { handleMatchMediaFilesToEpisodeRequest } from './src/route/ai';
import { handleDownloadImageAsFileRequest } from './src/route/DownloadImageAsFile';
import { handleOpenInFileManagerRequest } from './src/route/OpenInFileManager';
import { handleOpenFile } from './src/route/OpenFile';
import { handleScrapeRequest } from './src/route/Scrape';
import { handleDebugRequest } from './src/route/Debug';
import { handleGetPendingPlans } from './src/route/GetPendingPlans';
import { handleRejectPlan } from './src/route/RejectPlan';
import { requestId } from 'hono/request-id';
import { logger } from './lib/logger';
import { Server as SocketIOServer } from 'socket.io';
import { Server as Engine } from '@socket.io/bun-engine';

export interface ServerConfig {
  port?: number;
  root?: string;
}

export class Server {
  private app: Hono;
  private server: ReturnType<typeof Bun.serve> | null = null;
  private port: number;
  private root: string;
  private io: SocketIOServer;
  private engine: Engine;

  constructor(config: ServerConfig = {}) {
    this.port = config.port ?? parseInt(process.env.PORT || '3000');
    const rootPath = config.root ?? './public';
    this.root = path.resolve(rootPath);
    
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
      
      logger.info({ requestId: reqId, method, path }, 'incoming request');
      
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
    
    this.setupMiddleware();
    this.setupRoutes();
    
    // Initialize Socket.IO connection handlers
    initializeSocketIO(this.io);
  }

  private setupMiddleware() {
    // Add logging middleware
    // this.app.use('*', honoLogger());
  }

  private setupRoutes() {
    // Zod schema for request body validation
    const executeRequestSchema = z.object({
      name: z.enum(['hello', 'system', 'GetSelectedMediaMetadata'], {
        message: 'name must be one of: "hello", "system", "GetSelectedMediaMetadata"'
      }),
      data: z.any()
    });

    // Register route handlers
    handleChatRequest(this.app);
    handleReadFile(this.app);
    handleWriteFile(this.app);
    handleRenameFile(this.app);
    handleRenameFolder(this.app);
    handleNewFileName(this.app);
    handleReadImage(this.app);
    handleDownloadImage(this.app);
    handleListFiles(this.app);
    handleListDrives(this.app);
    handleReadMediaMetadata(this.app);
    handleWriteMediaMetadata(this.app);
    handleDeleteMediaMetadata(this.app);
    handleMatchMediaFilesToEpisodeRequest(this.app);
    handleDownloadImageAsFileRequest(this.app);
    handleOpenInFileManagerRequest(this.app);
    handleOpenFile(this.app);
    handleScrapeRequest(this.app);
    handleDebugRequest(this.app);
    handleGetPendingPlans(this.app);
    handleRejectPlan(this.app);
    handleTmdb(this.app);

    // POST /api/execute - Special orchestration route for multiple tasks
    this.app.post('/api/execute', async (c) => {
      try {
        const rawBody = await c.req.json();
        
        // Validate request body with Zod
        const validationResult = executeRequestSchema.safeParse(rawBody);
        
        if (!validationResult.success) {
          return c.json({ 
            error: 'Validation failed',
            details: validationResult.error.issues.map((err) => ({
              path: err.path.join('.'),
              message: err.message
            }))
          }, 400);
        }

        const body = validationResult.data;

        // Execute task based on name
        if (body.name === 'hello') {
          const result = await executeHelloTask();
          return c.json(result);
        }

        if (body.name === 'GetSelectedMediaMetadata') {
          const result = await executeGetSelectedMediaMetadataTask();
          return c.json(result);
        }

        // Handle other task names (e.g., 'system')
        return c.json({ 
          error: `Task "${body.name}" is not yet implemented`
        }, 501);
      } catch (error) {
        return c.json({ 
          error: 'Invalid JSON body or parsing error',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, 400);
      }
    });

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
        const url = new URL(req.url);

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
  }

  stop(): void {
    if (!this.server) {
      logger.warn('Server is not running.');
      return;
    }

    this.server.stop();
    this.server = null;
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
