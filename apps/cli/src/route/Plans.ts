import type { Hono } from 'hono';
import {
  doCreatePlan as doCreatePlanCore,
  doGetPlanById as doGetPlanByIdCore,
  doGetPlans as doGetPlansCore,
  doUpdatePlan as doUpdatePlanCore,
  type CoreRoutesConfig,
} from '@smm/core-routes';
import { logger } from '../../lib/logger';
import { buildAllowlist } from '@/utils/buildAllowlist';
import { getAppDataDir } from '@/utils/config';

const coreRoutesLogger = {
  debug: (obj: Record<string, unknown>, msg?: string) => logger.debug(obj, msg),
  info: (obj: Record<string, unknown>, msg?: string) => logger.info(obj, msg),
  warn: (obj: Record<string, unknown>, msg?: string) => logger.warn(obj, msg),
  error: (obj: Record<string, unknown>, msg?: string) => logger.error(obj, msg),
};

async function buildConfig(): Promise<CoreRoutesConfig> {
  const allowlist = await buildAllowlist();
  return {
    allowlist,
    appDataDir: getAppDataDir(),
    logger: coreRoutesLogger,
  };
}

/**
 * Registers the unified plan routes by delegating to the shared
 * `@smm/core-routes` `do*` functions (same logic as OHOS):
 * - `POST /api/getPlans`    — active plans for a media folder
 * - `POST /api/getPlanById` — load a plan file by id
 * - `POST /api/createPlan`  — create a `preparing` plan
 * - `POST /api/updatePlan`  — patch status/files (terminal => delete)
 */
export function handlePlans(app: Hono): void {
  app.post('/api/getPlans', async (c) => {
    try {
      const body = await c.req.json();
      const result = await doGetPlansCore(body, await buildConfig());
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, '[POST /api/getPlans] route error');
      return c.json(
        { error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}` },
        200,
      );
    }
  });

  app.post('/api/createPlan', async (c) => {
    try {
      const body = await c.req.json();
      const result = await doCreatePlanCore(body, await buildConfig());
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, '[POST /api/createPlan] route error');
      return c.json(
        { error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}` },
        200,
      );
    }
  });

  app.post('/api/getPlanById', async (c) => {
    try {
      const body = await c.req.json();
      const result = await doGetPlanByIdCore(body, await buildConfig());
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, '[POST /api/getPlanById] route error');
      return c.json(
        { error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}` },
        200,
      );
    }
  });

  app.post('/api/updatePlan', async (c) => {
    try {
      const body = await c.req.json();
      const result = await doUpdatePlanCore(body, await buildConfig());
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, '[POST /api/updatePlan] route error');
      return c.json(
        { error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}` },
        200,
      );
    }
  });
}
