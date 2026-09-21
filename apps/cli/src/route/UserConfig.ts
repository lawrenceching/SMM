import type { CoreRoutesLogger, HelloOptions } from "@smm/core-routes";
import {
  doGetUserConfig as doGetUserConfigCore,
  doPatchUserConfig as doPatchUserConfigCore,
} from "@smm/core-routes";
import type { PatchUserConfigRequestBody } from "@smm/types";
import type { Hono } from "hono";
import { getUserDataDir } from "@/utils/config";
import { logger, logHttpReqIn, logHttpRespOut } from "../../lib/logger";

const coreRoutesLogger: CoreRoutesLogger = {
  debug: (obj: Record<string, unknown>, msg?: string) => logger.debug(obj, msg),
  info: (obj: Record<string, unknown>, msg?: string) => logger.info(obj, msg),
  warn: (obj: Record<string, unknown>, msg?: string) => logger.warn(obj, msg),
  error: (obj: Record<string, unknown>, msg?: string) => logger.error(obj, msg),
};

function coreConfig() {
  return {
    allowlist: [] as string[],
    logger: coreRoutesLogger,
    hello: { userDataDir: getUserDataDir() } as HelloOptions,
  };
}

/**
 * Hono shell for user-config reads and JSON Patch writes.
 * Delegates to `@smm/core-routes` so CLI, Electron, and HarmonyOS share one implementation.
 */
export function handleUserConfig(app: Hono) {
  app.post("/api/getUserConfig", async (c) => {
    try {
      const rawBody = await c.req.json().catch(() => ({}));
      logHttpReqIn(c, rawBody);
      const result = await doGetUserConfigCore(coreConfig());
      logHttpRespOut(c, result, 200);
      return c.json(result, 200);
    } catch (error) {
      const respBody = {
        error: "Error Reason: Failed to read user config",
        details: error instanceof Error ? error.message : "Unknown error",
      };
      logHttpRespOut(c, respBody, 500);
      return c.json(respBody, 500);
    }
  });

  app.post("/api/patchUserConfig", async (c) => {
    try {
      const rawBody = (await c.req.json()) as PatchUserConfigRequestBody;
      logHttpReqIn(c, rawBody);
      const result = await doPatchUserConfigCore(rawBody, coreConfig());
      logHttpRespOut(c, result, 200);
      return c.json(result, 200);
    } catch (error) {
      const respBody = {
        error: "Invalid JSON body",
        details: error instanceof Error ? error.message : "Unknown error",
      };
      logHttpRespOut(c, respBody, 400);
      return c.json(respBody, 400);
    }
  });
}
