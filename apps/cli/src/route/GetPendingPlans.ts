import type { Hono } from 'hono';
import { logger } from '../../lib/logger';
import { getAllPendingTasks } from '../tools/recognizeMediaFilesTool';
import { getAllPendingRenamePlans } from '../tools/renameFilesToolV2';
import type { RecognizeMediaFilePlan } from '@core/types/RecognizeMediaFilePlan';
import type { RenameFilesPlan } from '@core/types/RenameFilesPlan';

export interface GetPendingPlansResponseBody {
  data: RecognizeMediaFilePlan[];
  renamePlans: RenameFilesPlan[];
  error?: string;
}

export async function processGetPendingPlans(): Promise<GetPendingPlansResponseBody> {
  try {
    const [pendingPlans, renamePlans] = await Promise.all([
      getAllPendingTasks(),
      getAllPendingRenamePlans(),
    ]);

    return {
      data: pendingPlans,
      renamePlans,
    };
  } catch (error) {
    logger.error({ error }, 'GetPendingPlans processing error:');
    return {
      data: [],
      renamePlans: [],
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
        renamePlans: [],
        error: `Error Reason: ${error instanceof Error ? error.message : 'Failed to process get pending plans request'}`,
      }, 200);
    }
  });
}
