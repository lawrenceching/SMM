import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { logger } from 'hono/logger';

export interface ServerConfig {
  port?: number;
  root?: string;
}

export class Server {
  private app: Hono;
  private server: ReturnType<typeof Bun.serve> | null = null;
  private port: number;
  private root: string;

  constructor(config: ServerConfig = {}) {
    this.port = config.port ?? parseInt(process.env.PORT || '3000');
    this.root = config.root ?? './public';
    
    this.app = new Hono();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    // Add logging middleware
    this.app.use('*', logger());
  }

  private setupRoutes() {
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
      console.warn('Server is already running.');
      return;
    }

    this.server = Bun.serve({
      port: this.port,
      fetch: this.app.fetch,
    });

    console.log(`🚀 Static file server running on http://localhost:${this.port}`);
  }

  stop(): void {
    if (!this.server) {
      console.warn('Server is not running.');
      return;
    }

    this.server.stop();
    this.server = null;
    console.log('Server stopped.');
  }

  getApp(): Hono {
    return this.app;
  }

  getPort(): number {
    return this.port;
  }

  isRunning(): boolean {
    return this.server !== null;
  }
}
