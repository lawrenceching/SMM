import type { Hono } from "hono";
import {
  doDownloadImage as doDownloadImageCore,
  type DownloadImageResult,
} from "@smm/core-routes";
import { buildAllowlist } from "@/utils/buildAllowlist";
import { logger } from "../../lib/logger";

const coreRoutesLogger = {
  debug: (obj: Record<string, unknown>, msg?: string) => logger.debug(obj, msg),
  info: (obj: Record<string, unknown>, msg?: string) => logger.info(obj, msg),
  warn: (obj: Record<string, unknown>, msg?: string) => logger.warn(obj, msg),
  error: (obj: Record<string, unknown>, msg?: string) => logger.error(obj, msg),
};

/**
 * Hono shell for `GET /api/image`.
 *
 * Delegates to `doDownloadImage` from `@smm/core-routes`. The
 * shared core function handles URL routing (`http(s)://`,
 * `file://`, protocol-relative `//`), the `file://` allowlist
 * check, and Content-Type inference. This shell is responsible
 * only for:
 *   - reading `?url=` from the query string,
 *   - writing the binary response with the right headers,
 *   - mapping thrown errors to `500 { error }` JSON.
 */
export async function processDownloadImage(url: string): Promise<DownloadImageResult> {
  const allowlist = await buildAllowlist();
  return doDownloadImageCore(url, { allowlist, logger: coreRoutesLogger });
}

export function handleDownloadImage(app: Hono) {
  // GET /api/image?url=xxxx - Download and return image from URL
  app.get("/api/image", async (c) => {
    try {
      const url = c.req.query("url");

      if (!url) {
        return c.json(
          {
            error: "Missing required query parameter: url",
          },
          400,
        );
      }

      const { buffer, contentType } = await processDownloadImage(url);
      return new Response(buffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Length": buffer.length.toString(),
          "Cache-Control": "public, max-age=31536000",
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        { error: { message: errorMessage } },
        "DownloadImage route error:",
      );
      return c.json(
        {
          error: `Failed to download image: ${errorMessage}`,
        },
        500,
      );
    }
  });
}