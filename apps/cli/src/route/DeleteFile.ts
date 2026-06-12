import type { Hono } from "hono";
import {
  doDeleteFile as doDeleteFileCore,
  type DeleteFileRequestBody,
  type DeleteFileResponseBody,
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
 * Hono shell for `POST /api/deleteFile`.
 *
 * Delegates to `doDeleteFile` in `@smm/core-routes`. Path validation
 * is now allowlist-based (any path inside the allowlist is deletable;
 * previously restricted to `{userDataDir}/temp/ytdlp-cookies-*.txt`
 * via `isManagedYtdlpCookiesPath`).
 */
export async function processDeleteFile(
  body: DeleteFileRequestBody,
): Promise<DeleteFileResponseBody> {
  const allowlist = await buildAllowlist();
  return doDeleteFileCore(body, { allowlist, logger: coreRoutesLogger });
}

export function handleDeleteFile(app: Hono) {
  app.post("/api/deleteFile", async (c) => {
    try {
      const rawBody = await c.req.json();
      logHttpReqIn(c, rawBody);
      const result = await processDeleteFile(rawBody);
      logHttpRespOut(c, result, 200);
      return c.json(result, 200);
    } catch (error) {
      const respBody = {
        error: `Unexpected Error: ${
          error instanceof Error ? error.message : "Failed to process delete file request"
        }`,
      };
      logHttpRespOut(c, respBody, 200);
      return c.json(respBody, 200);
    }
  });
}