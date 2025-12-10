import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { logger } from 'hono/logger';
import path from 'path';
import { z } from 'zod';
import type { ApiExecutePostRequestBody } from '../core/types';
import { executeHelloTask } from './tasks/HelloTask';

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
    const rootPath = config.root ?? './public';
    this.root = path.resolve(rootPath);
    
    this.app = new Hono();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    // Add logging middleware
    this.app.use('*', logger());
  }

  private setupRoutes() {
    // Zod schema for request body validation
    const executeRequestSchema = z.object({
      name: z.enum(['hello', 'system'], {
        message: 'name must be one of: "hello", "system"'
      }),
      data: z.any()
    });

    // API routes
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

    console.log(`📁 Static file root: ${this.root}`);
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
