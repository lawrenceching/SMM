import { z } from 'zod/v3';
import { logger } from '../../../lib/logger';
import { agentTools } from '../../tools';
import type { Hono } from 'hono';

interface ApplicationContextData {
  selectedMediaFolder: string;
  language: string;
}

interface DebugGetApplicationContextResponseBody {
  success: boolean;
  data?: ApplicationContextData;
  error?: string;
}

const getApplicationContextSchema = z.object({
  clientId: z.string().optional(),
});

export async function processGetApplicationContext(body: unknown): Promise<DebugGetApplicationContextResponseBody> {
  try {
    console.log('[DebugAPI] Received getApplicationContext request:', body);

    const validationResult = getApplicationContextSchema.safeParse(body ?? {});
    if (!validationResult.success) {
      return {
        success: false,
        error: `Validation failed: ${validationResult.error.issues.map(i => i.message).join(', ')}`,
      };
    }

    const { clientId = '' } = validationResult.data;
    const tool = agentTools.getApplicationContext(clientId);
    const result = await tool.execute({});

    if (result.isError) {
      const errorMessage = result.content?.[0]?.text ?? 'Unknown error';
      return {
        success: false,
        error: errorMessage,
      };
    }

    const data = result.structuredContent as ApplicationContextData | undefined;
    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('[DebugAPI] Error executing getApplicationContext:', error);
    return {
      success: false,
      error: `Failed to execute getApplicationContext: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export function handleDebugGetApplicationContextRoute(app: Hono) {
  app.post('/debug/getApplicationContext', async (c) => {
    try {
      let rawBody: unknown = {};
      try {
        rawBody = await c.req.json();
      } catch {
        rawBody = {};
      }

      const result = await processGetApplicationContext(rawBody);
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'Debug API getApplicationContext route error:');
      return c.json({
        success: false,
        error: `Failed to process getApplicationContext request: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }, 500);
    }
  });
}
