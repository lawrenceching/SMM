import type { IncomingMessage, ServerResponse } from "node:http";
import type { DeleteFolderRequestBody } from "@smm/types";
import { doDeleteFolder } from "../deleteFolder.ts";
import { readJsonBody, sendJson } from "../http.ts";
import type { RouteContext } from "../types.ts";

/**
 * Node `http` handler for `POST /api/deleteFolder`.
 *
 * Reads the JSON body, calls `doDeleteFolder` from `@smm/core-routes`,
 * and writes the `{ data } | { error }` JSON response. Invalid JSON
 * is mapped to `400`. Validation failures (e.g. missing `path`) are
 * returned as `200 { error }` to mirror the Hono adapter in
 * `apps/cli/src/route/DeleteFolder.ts`.
 */
export async function handleDeleteFolderPost(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RouteContext,
): Promise<boolean> {
  if (req.method !== "POST" || ctx.url.pathname !== "/api/deleteFolder") {
    return false;
  }

  try {
    const rawBody = (await readJsonBody(req)) as DeleteFolderRequestBody;
    ctx.config.logger?.info({ rawBody }, "[DeleteFolder] POST /api/deleteFolder");
    const result = await doDeleteFolder(rawBody, ctx.config);
    sendJson(res, 200, result);
    return true;
  } catch (error) {
    ctx.config.logger?.error({ error }, "DeleteFolder POST route error");
    sendJson(res, 400, {
      error: "Invalid JSON body",
      details: error instanceof Error ? error.message : "Unknown error",
    });
    return true;
  }
}
