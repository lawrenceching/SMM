import { Hono } from 'hono';
import { validator } from 'hono/validator';
import { z } from 'zod';
import { executeGetSelectedMediaMetadataTask } from '../../tasks/GetSelectedMediaMetadataTask';

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
 * POST /api/execute (cli-specific orchestration).
 *
 * GET /api/hello is served by core-routes on the unified HTTP server.
 */
export const executeRoute = new Hono().post(
  '/api/execute',
  validator('json', (value, c) => {
    const validationResult = executeRequestSchema.safeParse(value);

    if (!validationResult.success) {
      return c.json({
        error: 'Validation failed',
        details: validationResult.error.issues.map((err) => ({
          path: err.path.join('.'),
          message: err.message
        }))
      }, 400);
    }

    return validationResult.data;
  }),
  async (c) => {
    const body = c.req.valid('json');

    try {
      if (body.name === 'GetSelectedMediaMetadata') {
        const result = await executeGetSelectedMediaMetadataTask();
        return c.json(result, 200);
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
  },
);
