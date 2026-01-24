import type { Hono } from 'hono';
import { logger } from '../../lib/logger';
import { getAllPendingTasks } from '../tools/recognizeMediaFilesTool';
import type { RecognizeMediaFilePlan } from '@core/types/RecognizeMediaFilePlan';

export interface GetPendingPlansResponseBody {
  data: RecognizeMediaFilePlan[];
  error?: string;
}

export async function processGetPendingPlans(): Promise<GetPendingPlansResponseBody> {
  try {
    const pendingPlans = await getAllPendingTasks();
    
    return {
      data: pendingPlans,
    };
  } catch (error) {
    logger.error({ error }, 'GetPendingPlans processing error:');
    return {
      data: [],
      error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export function handleGetPendingPlans(app: Hono) {
  app.post('/api/getPendingPlans', async (c) => {
    try {
      const result = await processGetPendingPlans();
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'GetPendingPlans route error:');
      return c.json({ 
        data: [],
        error: `Error Reason: ${error instanceof Error ? error.message : 'Failed to process get pending plans request'}`,
      }, 200);
    }
  });
}
