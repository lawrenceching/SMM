import type { Hono } from "hono";
import {
  doDeleteFolder as doDeleteFolderCore,
  type DeleteFolderRequestBody,
  type DeleteFolderResponseBody,
} from "@smm/core-routes";
import { buildAllowlist } from "@/utils/buildAllowlist";
import { logger, logHttpReqIn, logHttpRespOut } from "../../lib/logger";

const coreRoutesLogger = {
  debug: (obj, msg) => logger.debug(obj, msg),
  info: (obj, msg) => logger.info(obj, msg),
  warn: (obj, msg) => logger.warn(obj, msg),
  error: (obj, msg) => logger.error(obj, msg),
};

/**
 * Hono shell for `POST /api/deleteFolder`.
 *
 * Delegates to `doDeleteFolder` in `@smm/core-routes`. Path validation
 * is allowlist-based (any directory inside the allowlist is deletable).
 */
export async function processDeleteFolder(
  body: DeleteFolderRequestBody,
): Promise<DeleteFolderResponseBody> {
  const allowlist = await buildAllowlist();
  return doDeleteFolderCore(body, { allowlist, logger: coreRoutesLogger });
}

export function handleDeleteFolder(app: Hono) {
  app.post("/api/deleteFolder", async (c) => {
    try {
      const rawBody = await c.req.json();
      logHttpReqIn(c, rawBody);
      const result = await processDeleteFolder(rawBody);
      logHttpRespOut(c, result, 200);
      return c.json(result, 200);
    } catch (error) {
      const respBody = {
        error: `Unexpected Error: ${
          error instanceof Error ? error.message : "Failed to process delete folder request"
        }`,
      };
      logHttpRespOut(c, respBody, 200);
      return c.json(respBody, 200);
    }
  });
}
