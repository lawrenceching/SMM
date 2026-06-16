import type { IncomingMessage, ServerResponse } from "node:http";
import type { DownloadImageRequestBody } from "@smm/core/types";
import { doDownloadImageAsFile } from "../downloadImageAsFile.ts";
import { readJsonBody, sendJson } from "../http.ts";
import type { RouteContext } from "../types.ts";

/**
 * Node `http` handler for `POST /api/downloadImage`.
 *
 * Reads the JSON body, calls `doDownloadImageAsFile` from
 * `@smm/core-routes`, and writes the `{ data, error? }` JSON
 * response. Mirrors the Hono adapter in
 * `apps/cli/src/route/DownloadImageAsFile.ts`:
 *   - 200 with `{ data, error? }` on success or application
 *     error (e.g. existing destination file, non-2xx upstream).
 *   - 400 with `{ error: 'Invalid JSON body' }` on parse failure.
 *   - 500 is not used; all errors are caught inside
 *     `doDownloadImageAsFile` and returned as `{ data, error }`.
 */
export async function handleDownloadImageAsFilePost(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RouteContext,
): Promise<boolean> {
  if (req.method !== "POST" || ctx.url.pathname !== "/api/downloadImage") {
    return false;
  }

  try {
    const rawBody = (await readJsonBody(req)) as DownloadImageRequestBody;
    ctx.config.logger?.info(
      { rawBody },
      "[DownloadImageAsFile] POST /api/downloadImage",
    );
    const result = await doDownloadImageAsFile(rawBody, ctx.config);
    sendJson(res, 200, result);
    return true;
  } catch (error) {
    ctx.config.logger?.error(
      { error },
      "DownloadImageAsFile POST route error",
    );
    sendJson(res, 400, {
      error: "Invalid JSON body",
      details: error instanceof Error ? error.message : "Unknown error",
    });
    return true;
  }
}
