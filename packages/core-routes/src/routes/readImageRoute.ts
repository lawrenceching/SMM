import type { IncomingMessage, ServerResponse } from "node:http";
import type { ReadImageRequestBody } from "@smm/core/types";
import { doReadImage } from "../readImage.ts";
import { readJsonBody, sendJson } from "../http.ts";
import type { RouteContext } from "../types.ts";

/**
 * Node `http` handler for `POST /api/readImage`.
 *
 * Reads the JSON body, calls `doReadImage` from
 * `@smm/core-routes`, and writes the `{ data?, error? }` JSON
 * response. Mirrors the Hono adapter in
 * `apps/cli/src/route/ReadImage.ts:handleReadImage`:
 *   - 200 with `{ data, error? }` on success or validation /
 *     allowlist / I/O failure. The original Hono handler maps
 *     all of these to 200; we preserve that contract so the UI
 *     does not need to change.
 *   - 400 with `{ error: 'Invalid JSON body' }` on parse failure.
 *   - 500 is not used; all errors are caught inside
 *     `doReadImage` and returned as `{ error }`.
 */
export async function handleReadImagePost(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RouteContext,
): Promise<boolean> {
  if (req.method !== "POST" || ctx.url.pathname !== "/api/readImage") {
    return false;
  }

  try {
    const rawBody = (await readJsonBody(req)) as ReadImageRequestBody;
    ctx.config.logger?.info(
      { rawBody },
      "[ReadImage] POST /api/readImage",
    );
    const result = await doReadImage(rawBody, ctx.config);
    sendJson(res, 200, result);
    return true;
  } catch (error) {
    ctx.config.logger?.error(
      { error },
      "ReadImage POST route error",
    );
    sendJson(res, 400, {
      error: "Invalid JSON body",
      details: error instanceof Error ? error.message : "Unknown error",
    });
    return true;
  }
}
