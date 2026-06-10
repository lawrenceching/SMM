import { Hono } from 'hono';
import { z } from 'zod';
import { executeHelloTask } from '../../tasks/HelloTask';
import { executeGetSelectedMediaMetadataTask } from '../../tasks/GetSelectedMediaMetadataTask';
import type { ReverseProxyManager } from '@/proxy/reverseProxy';

/**
 * Zod schema for /api/execute request body validation.
 *
 * Note: the bootstrap handshake ("hello") is exposed at POST /api/hello,
 * not through this /api/execute orchestration endpoint.
 */
const executeRequestSchema = z.object({
  name: z.enum(['system', 'GetSelectedMediaMetadata'], {
    message: 'name must be one of: "system", "GetSelectedMediaMetadata"'
  }),
  data: z.any()
});

/**
 * Register /api/hello and /api/execute routes on the given Hono app.
 *
 * POST /api/hello — Application bootstrap handshake. Returns environment
 *   paths, version, reverse-proxy URL and OS locale. Body is ignored; an
 *   empty body is acceptable.
 *
 * POST /api/execute — Special orchestration route for multiple user tasks.
 *   Currently dispatches `name: "GetSelectedMediaMetadata"`. The previous
 *   `name: "hello"` task has been moved to /api/hello.
 */
export function registerExecuteRoutes(app: Hono, proxyManager: ReverseProxyManager): void {
  // POST /api/hello - Application bootstrap handshake.
  // Returns environment paths, version, reverse-proxy URL and OS locale.
  // Body is ignored; an empty body is acceptable.
  app.post('/api/hello', async (c) => {
    const result = await executeHelloTask(proxyManager.url);
    return c.json(result);
  });

  // POST /api/execute - Special orchestration route for multiple tasks
  app.post('/api/execute', async (c) => {
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
}
