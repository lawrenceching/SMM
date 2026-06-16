import type {
  DownloadImageRequestBody,
  DownloadImageResponseBody,
} from "@core/types";
import { doDownloadImageAsFile as doDownloadImageAsFileCore } from "@smm/core-routes";
import type { Hono } from "hono";
import { buildAllowlist } from "@/utils/buildAllowlist";
import { logger } from "../../lib/logger";

const coreRoutesLogger = {
  debug: (obj: Record<string, unknown>, msg?: string) => logger.debug(obj, msg),
  info: (obj: Record<string, unknown>, msg?: string) => logger.info(obj, msg),
  warn: (obj: Record<string, unknown>, msg?: string) => logger.warn(obj, msg),
  error: (obj: Record<string, unknown>, msg?: string) => logger.error(obj, msg),
};

/**
 * Hono shell for `POST /api/downloadImage`.
 *
 * Delegates to `doDownloadImageAsFile` from `@smm/core-routes`.
 * The shared core function handles validation, the allowlist
 * check, the destination-file existence check, URL fetching,
 * and writing the bytes via `node:fs/promises`. This shell is
 * responsible only for request parsing and the JSON response.
 *
 * The response status is `200` for both success and application-
 * level failure (e.g. existing destination file, non-2xx
 * upstream). This matches the original behavior so the UI does
 * not need to change.
 */
export async function processDownloadImageAsFile(
  body: DownloadImageRequestBody,
): Promise<DownloadImageResponseBody> {
  const allowlist = await buildAllowlist();
  return doDownloadImageAsFileCore(body, { allowlist, logger: coreRoutesLogger });
}

export function handleDownloadImageAsFileRequest(app: Hono) {
  app.post("/api/downloadImage", async (c) => {
    const body = (await c.req.json()) as DownloadImageRequestBody;
    console.log(`[DownloadImageAsFile] Downloading image from ${body.url} to ${body.path}`);
    try {
      const result = await processDownloadImageAsFile(body);
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, "DownloadImageAsFile route error:");
      const fallback: DownloadImageResponseBody = {
        data: {
          url: typeof body?.url === "string" ? body.url : "",
          path: typeof body?.path === "string" ? body.path : "",
        },
        error: `Unexpected Error: ${
          error instanceof Error ? error.message : "Unknown error occurred"
        }`,
      };
      return c.json(fallback, 200);
    }
  });
}