import type { Hono } from 'hono';
import { z } from 'zod/v3';
import { logger } from '../../lib/logger';
import { rejectPlan } from '../tools/recognizeMediaFilesTool';

const rejectPlanRequestSchema = z.object({
  planId: z.string().describe('The UUID of the plan to reject'),
});

export interface RejectPlanResponseBody {
  data?: { success: boolean };
  error?: string;
}

export async function processRejectPlan(requestBody: unknown): Promise<RejectPlanResponseBody> {
  try {
    // Validate request body
    const validationResult = rejectPlanRequestSchema.safeParse(requestBody);
    
    if (!validationResult.success) {
      return {
        error: `Error Reason: Invalid request body: ${validationResult.error.issues.map(i => i.message).join(', ')}`,
      };
    }

    const { planId } = validationResult.data;

    // Reject the plan
    await rejectPlan(planId);

    return {
      data: { success: true },
    };
  } catch (error) {
    logger.error({ error }, 'RejectPlan processing error:');
    return {
      error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export function handleRejectPlan(app: Hono) {
  app.post('/api/rejectPlan', async (c) => {
    try {
      const requestBody = await c.req.json();
      const result = await processRejectPlan(requestBody);
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'RejectPlan route error:');
      return c.json({ 
        error: `Error Reason: ${error instanceof Error ? error.message : 'Failed to process reject plan request'}`,
      }, 200);
    }
  });
}
