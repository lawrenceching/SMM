import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { logger } from 'hono/logger';
import path from 'path';
import { z } from 'zod';
import type { ApiExecutePostRequestBody } from '../core/types';
import { executeHelloTask } from './tasks/HelloTask';
import { handleChatRequest } from './tasks/ChatTask';
import { handleReadFile } from './src/route/ReadFile';
import { handleWriteFile } from './src/route/WriteFile';
import { handleReadImage } from './src/route/ReadImage';
import { handleListFiles } from './src/route/ListFiles';
import { handleDownloadImage } from './src/route/DownloadImage';
import { handleReadMediaMetadata } from '@/route/mediaMetadata/read';
import { handleWriteMediaMetadata } from '@/route/mediaMetadata/write';
import { handleDeleteMediaMetadata } from '@/route/mediaMetadata/delete';
import { search as handleTmdbSearch, getMovie as handleTmdbGetMovie, getTvShow as handleTmdbGetTvShow } from './src/route/Tmdb';
import { handleMatchMediaFilesToEpisodeRequest } from './src/route/ai';
import { handleDownloadImageAsFileRequest } from './src/route/DownloadImageAsFile';
import { handleOpenInFileManagerRequest } from './src/route/OpenInFileManager';

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
    this.app.post('/api/chat', async (c) => {
      try {
        // Use Hono's native request object
        const response = await handleChatRequest(c.req.raw);
        return response;
      } catch (error) {
        console.error('Chat route error:', error);
        return c.json({ 
          error: 'Failed to process chat request',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, 500);
      }
    });

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

    this.app.post('/api/readFile', async (c) => {
      try {
        const rawBody = await c.req.json();
        const result = await handleReadFile(rawBody);
        
        // If there's an error, return 400, otherwise 200
        if (result.error) {
          return c.json(result, 400);
        }
        return c.json(result);
      } catch (error) {
        console.error('ReadFile route error:', error);
        return c.json({ 
          error: 'Failed to process read file request',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, 500);
      }
    });

    this.app.post('/api/writeFile', async (c) => {
      
      try {
        const rawBody = await c.req.json();
        console.log(`[HTTP_IN] ${c.req.method} ${c.req.url} ${rawBody.path}`)
        const result = await handleWriteFile(rawBody);
        
        // If there's an error, return 400, otherwise 200
        if (result.error) {
          return c.json(result, 400);
        }
        return c.json(result);
      } catch (error) {
        console.error('WriteFile route error:', error);
        return c.json({ 
          error: 'Failed to process write file request',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, 500);
      }
    });

    this.app.post('/api/readImage', async (c) => {
      try {
        const rawBody = await c.req.json();
        const result = await handleReadImage(rawBody);
        
        // If there's an error, return 400, otherwise 200
        if (result.error) {
          return c.json(result, 400);
        }
        return c.json(result);
      } catch (error) {
        console.error('ReadImage route error:', error);
        return c.json({ 
          error: 'Failed to process read image request',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, 500);
      }
    });

    // GET /api/image?url=xxxx - Download and return image from URL
    this.app.get('/api/image', async (c) => {
      try {
        const url = c.req.query('url');
        
        if (!url) {
          return c.json({ 
            error: 'Missing required query parameter: url'
          }, 400);
        }

        const imageResponse = await handleDownloadImage(url);
        return imageResponse;
      } catch (error) {
        console.error('DownloadImage route error:', error);
        return c.json({ 
          error: `Failed to download image: ${error instanceof Error ? error.message : 'Unknown error'}`
        }, 500);
      }
    });

    // GET /api/listFiles - supports query parameters
    this.app.get('/api/listFiles', async (c) => {
      try {
        const query = c.req.query();
        const body: any = {
          path: query.path || '',
        };
        if (query.onlyFiles !== undefined) {
          body.onlyFiles = query.onlyFiles === 'true';
        }
        if (query.onlyFolders !== undefined) {
          body.onlyFolders = query.onlyFolders === 'true';
        }
        if (query.includeHiddenFiles !== undefined) {
          body.includeHiddenFiles = query.includeHiddenFiles === 'true';
        }
        const result = await handleListFiles(body);
        return c.json(result, 200);
      } catch (error) {
        console.error('ListFiles route error:', error);
        return c.json({ 
          data: [],
          error: `Unexpected Error: ${error instanceof Error ? error.message : 'Failed to process list files request'}`,
        }, 200);
      }
    });

    // POST /api/listFiles - supports request body
    this.app.post('/api/listFiles', async (c) => {
      try {
        const rawBody = await c.req.json();
        const result = await handleListFiles(rawBody);
        return c.json(result, 200);
      } catch (error) {
        console.error('ListFiles route error:', error);
        return c.json({ 
          data: [],
          error: `Unexpected Error: ${error instanceof Error ? error.message : 'Failed to process list files request'}`,
        }, 200);
      }
    });

    handleReadMediaMetadata(this.app);
    handleWriteMediaMetadata(this.app);
    handleDeleteMediaMetadata(this.app);
    handleMatchMediaFilesToEpisodeRequest(this.app);
    handleDownloadImageAsFileRequest(this.app);
    handleOpenInFileManagerRequest(this.app);

    // POST /api/tmdb/search - Search TMDB for movies or TV shows
    this.app.post('/api/tmdb/search', async (c) => {
      try {
        const rawBody = await c.req.json();
        const result = await handleTmdbSearch(rawBody);
        
        // If there's an error, return 200 with error field (following the pattern)
        return c.json(result, 200);
      } catch (error) {
        console.error('TMDB search route error:', error);
        return c.json({ 
          results: [],
          page: 0,
          total_pages: 0,
          total_results: 0,
          error: `Failed to process TMDB search request: ${error instanceof Error ? error.message : 'Unknown error'}`
        }, 200);
      }
    });

    // GET /api/tmdb/movie/:id - Get movie by TMDB ID
    this.app.get('/api/tmdb/movie/:id', async (c) => {
      try {
        const id = parseInt(c.req.param('id'));
        const language = c.req.query('language') as 'zh-CN' | 'en-US' | 'ja-JP' | undefined;
        const baseURL = c.req.query('baseURL');
        
        if (isNaN(id)) {
          return c.json({
            data: undefined,
            error: 'Invalid movie ID'
          }, 200);
        }

        const result = await handleTmdbGetMovie(id, language, baseURL);
        return c.json(result, 200);
      } catch (error) {
        console.error('TMDB get movie route error:', error);
        return c.json({
          data: undefined,
          error: `Failed to get movie: ${error instanceof Error ? error.message : 'Unknown error'}`
        }, 200);
      }
    });

    // GET /api/tmdb/tv/:id - Get TV show by TMDB ID
    this.app.get('/api/tmdb/tv/:id', async (c) => {
      try {
        const id = parseInt(c.req.param('id'));
        const language = c.req.query('language') as 'zh-CN' | 'en-US' | 'ja-JP' | undefined;
        const baseURL = c.req.query('baseURL');
        
        if (isNaN(id)) {
          return c.json({
            data: undefined,
            error: 'Invalid TV show ID'
          }, 200);
        }

        const result = await handleTmdbGetTvShow(id, language, baseURL);
        return c.json(result, 200);
      } catch (error) {
        console.error('TMDB get TV show route error:', error);
        return c.json({
          data: undefined,
          error: `Failed to get TV show: ${error instanceof Error ? error.message : 'Unknown error'}`
        }, 200);
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
