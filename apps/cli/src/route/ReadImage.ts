import type { Hono } from "hono";
import { doReadImage as doReadImageCore } from "@smm/core-routes";
import type { ReadImageRequestBody, ReadImageResponseBody } from "@core/types";
import { buildAllowlist } from "@/utils/buildAllowlist";
import { logger } from "../../lib/logger";

const coreRoutesLogger = {
  debug: (obj: Record<string, unknown>, msg?: string) => logger.debug(obj, msg),
  info: (obj: Record<string, unknown>, msg?: string) => logger.info(obj, msg),
  warn: (obj: Record<string, unknown>, msg?: string) => logger.warn(obj, msg),
  error: (obj: Record<string, unknown>, msg?: string) => logger.error(obj, msg),
};

/**
 * Hono shell for `POST /api/readImage`.
 *
 * Delegates to `doReadImage` from `@smm/core-routes`. The
 * shared core function handles validation, the allowlist check,
 * image-extension validation, base64 encoding, and the same
 * error semantics as the original `ReadImage.ts`. This shell is
 * responsible only for request parsing and the JSON response.
 *
 * The response status is `200` for both success and validation
 * / allowlist / I/O failures. This matches the original Hono
 * handler contract so the UI does not need to change.
 */
export async function processReadImage(
  body: ReadImageRequestBody,
): Promise<ReadImageResponseBody> {
  const allowlist = await buildAllowlist();
  return doReadImageCore(body, { allowlist, logger: coreRoutesLogger });
}

export function handleReadImage(app: Hono) {
  app.post("/api/readImage", async (c) => {
    try {
      const rawBody = (await c.req.json()) as ReadImageRequestBody;
      const result = await processReadImage(rawBody);
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, "ReadImage route error:");
      const fallback: ReadImageResponseBody = {
        error: `Unexpected error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
      return c.json(fallback, 200);
    }
  });
}