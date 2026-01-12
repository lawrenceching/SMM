import type { OpenFileRequestBody, OpenFileResponseBody } from '@core/types';
import type { Hono } from 'hono';
import { openFile } from '../utils/os';

export function handleOpenFile(app: Hono) {
  app.post('/api/openFile', async (c) => {
    try {
      const body = await c.req.json() as OpenFileRequestBody;
      console.log(`[OpenFile] Opening file: ${body.path}`);
      
      // Validate path is provided
      if (!body.path || typeof body.path !== 'string') {
        const response: OpenFileResponseBody = {
          data: {
            path: body.path || '',
          },
          error: 'Validation Failed: Path is required and must be a string',
        };
        return c.json(response, 200);
      }
      
      // Open the file
      try {
        openFile(body.path);
        
        const response: OpenFileResponseBody = {
          data: {
            path: body.path,
          },
        };
        return c.json(response, 200);
      } catch (error) {
        const response: OpenFileResponseBody = {
          data: {
            path: body.path,
          },
          error: error instanceof Error ? `Open File Failed: ${error.message}` : 'Open File Failed: Unknown error occurred',
        };
        return c.json(response, 200);
      }
    } catch (error) {
      const response: OpenFileResponseBody = {
        data: {
          path: '',
        },
        error: `Unexpected Error: ${error instanceof Error ? error.message : 'Failed to process open file request'}`,
      };
      return c.json(response, 200);
    }
  });
}
