import { stat } from 'node:fs/promises';
import os from 'os';
import type { Hono } from 'hono';
import { logger } from '../../lib/logger';

export interface ListDrivesResponseBody {
  data: string[];
  error?: string;
}

export function handleListDrives(app: Hono) {
  app.get('/api/listDrives', async (c) => {
    try {
      // Only list drives on Windows
      if (os.platform() !== 'win32') {
        const response: ListDrivesResponseBody = {
          data: [],
          error: 'This endpoint is only available on Windows',
        };
        return c.json(response, 200);
      }

      const drives: string[] = [];

      // Iterate through drive letters A-Z
      for (let i = 65; i <= 90; i++) {
        const driveLetter = String.fromCharCode(i);
        const drivePath = `${driveLetter}:\\`;

        try {
          // Check if the drive exists by trying to stat it
          await stat(drivePath);
          drives.push(drivePath);
        } catch (error) {
          // Drive doesn't exist or is not accessible, skip it
          continue;
        }
      }

      const response: ListDrivesResponseBody = {
        data: drives,
      };
      return c.json(response, 200);
    } catch (error) {
      logger.error({ error }, 'ListDrives route error:');
      const response: ListDrivesResponseBody = {
        data: [],
        error: `Unexpected Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
      return c.json(response, 200);
    }
  });
}
