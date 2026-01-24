import type { Hono } from 'hono';
import { logger } from '../../lib/logger';
import { getAllPendingTasks } from '../tools/recognizeMediaFilesTool';
import type { RecognizeMediaFilePlan } from '@core/types/RecognizeMediaFilePlan';

export interface GetPendingTasksResponseBody {
  data: RecognizeMediaFilePlan[];
  error?: string;
}

export async function processGetPendingTasks(): Promise<GetPendingTasksResponseBody> {
  try {
    const pendingTasks = await getAllPendingTasks();
    
    return {
      data: pendingTasks,
    };
  } catch (error) {
    logger.error({ error }, 'GetPendingTasks processing error:');
    return {
      data: [],
      error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export function handleGetPendingTasks(app: Hono) {
  app.post('/api/getPendingTasks', async (c) => {
    try {
      const result = await processGetPendingTasks();
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'GetPendingTasks route error:');
      return c.json({ 
        data: [],
        error: `Error Reason: ${error instanceof Error ? error.message : 'Failed to process get pending tasks request'}`,
      }, 200);
    }
  });
}
