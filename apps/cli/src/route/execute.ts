import { Hono } from 'hono';
import { z } from 'zod';
import { executeGetSelectedMediaMetadataTask } from '../../tasks/GetSelectedMediaMetadataTask';
import type { ReverseProxyManager } from '@smm/core-routes';

/**
 * Zod schema for /api/execute request body validation.
 *
 * Note: the bootstrap handshake ("hello") is GET /api/hello on core-routes.
 */
const executeRequestSchema = z.object({
  name: z.enum(['system', 'GetSelectedMediaMetadata'], {
    message: 'name must be one of: "system", "GetSelectedMediaMetadata"'
  }),
  data: z.any()
});

/**
 * Register /api/execute on the given Hono app (cli-specific orchestration).
 *
 * GET /api/hello is served by core-routes on the unified HTTP server.
 */
export function registerExecuteRoutes(app: Hono, _proxyManager: ReverseProxyManager): void {
  app.post('/api/execute', async (c) => {
    try {
      const rawBody = await c.req.json();

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

      if (body.name === 'GetSelectedMediaMetadata') {
        const result = await executeGetSelectedMediaMetadataTask();
        return c.json(result);
      }

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
