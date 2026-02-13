import type { Hono } from 'hono';
import { z } from 'zod/v3';
import { logger } from '../../lib/logger';
import { updatePlanStatus, type UpdatePlanStatus } from '../tools/recognizeMediaFilesTool';
import {
  updateRenamePlanStatus,
  type UpdateRenamePlanStatus,
} from '../tools/renameFilesToolV2';

const updatePlanRequestSchema = z.object({
  planId: z.string().describe('The UUID of the plan to update'),
  status: z.enum(['rejected', 'completed']).describe('The new status: reject or complete the plan'),
});

export type UpdatePlanResponseBody = {
  data?: { success: boolean };
  error?: string;
};

export async function processUpdatePlan(requestBody: unknown): Promise<UpdatePlanResponseBody> {
  try {
    const validationResult = updatePlanRequestSchema.safeParse(requestBody);

    if (!validationResult.success) {
      return {
        error: `Error Reason: Invalid request body: ${validationResult.error.issues.map((i) => i.message).join(', ')}`,
      };
    }

    const { planId, status } = validationResult.data;
    const statusTyped = status as UpdatePlanStatus;

    try {
      await updatePlanStatus(planId, statusTyped);
      return { data: { success: true } };
    } catch (recErr) {
      const msg = recErr instanceof Error ? recErr.message : String(recErr);
      if (!msg.includes('not found')) {
        throw recErr;
      }
      await updateRenamePlanStatus(planId, status as UpdateRenamePlanStatus);
      return { data: { success: true } };
    }
  } catch (error) {
    logger.error({ error }, 'UpdatePlan processing error:');
    return {
      error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export function handleUpdatePlan(app: Hono) {
  app.post('/api/updatePlan', async (c) => {
    try {
      const requestBody = await c.req.json();
      const result = await processUpdatePlan(requestBody);
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'UpdatePlan route error:');
      return c.json(
        {
          error: `Error Reason: ${error instanceof Error ? error.message : 'Failed to process update plan request'}`,
        },
        200
      );
    }
  });
}
