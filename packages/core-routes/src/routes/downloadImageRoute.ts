import type { IncomingMessage, ServerResponse } from "node:http";
import { doDownloadImage } from "../downloadImage.ts";
import { sendJson } from "../http.ts";
import type { RouteContext } from "../types.ts";

/**
 * Node `http` handler for `GET /api/image?url=…`.
 *
 * Reads the `url` query parameter, calls `doDownloadImage` from
 * `@smm/core-routes`, and writes the binary image response
 * (with `Content-Type` / `Content-Length` / `Cache-Control`
 * headers) directly to `res`. On error, returns a JSON response
 * via `sendJson` (the binary response cannot be sent on failure
 * because headers have not been written yet).
 *
 * The HTTP status codes mirror the original Hono adapter in
 * `apps/cli/src/route/DownloadImage.ts:handleDownloadImage`:
 *   - 400 when `url` is missing.
 *   - 500 on download / read failure.
 *   - 200 with the image bytes on success.
 */
export async function handleDownloadImageGet(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RouteContext,
): Promise<boolean> {
  if (req.method !== "GET" || ctx.url.pathname !== "/api/image") {
    return false;
  }

  const url = ctx.url.searchParams.get("url");
  if (!url) {
    sendJson(res, 400, {
      error: "Missing required query parameter: url",
    });
    return true;
  }

  try {
    const result = await doDownloadImage(url, ctx.config);
    res.writeHead(200, {
      "Content-Type": result.contentType,
      "Content-Length": result.buffer.length.toString(),
      "Cache-Control": "public, max-age=31536000",
    });
    res.end(result.buffer);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ctx.config.logger?.error(
      { url, error: message },
      "DownloadImage GET route error",
    );
    sendJson(res, 500, {
      error: `Failed to download image: ${message}`,
    });
    return true;
  }
}
