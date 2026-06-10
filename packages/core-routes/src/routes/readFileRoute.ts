import type { IncomingMessage, ServerResponse } from "node:http";
import type { ReadFileRequestBody } from "@smm/core/types";
import { doReadFile } from "../readFile.ts";
import { readJsonBody, sendJson } from "../http.ts";
import type { RouteContext } from "../types.ts";

/**
 * Node `http` handler for `POST /api/readFile`.
 *
 * Reads the JSON body, calls `doReadFile` from `@smm/core-routes`, and
 * writes the `{ data } | { error }` JSON response. Validation failures
 * (e.g. missing `path`) are returned as `200 { error }` to mirror the
 * Hono adapter in `apps/cli/src/route/ReadFile.ts`. Invalid JSON is
 * `400`.
 */
export async function handleReadFilePost(
 req: IncomingMessage,
 res: ServerResponse,
 ctx: RouteContext,
): Promise<boolean> {
 if (req.method !== "POST" || ctx.url.pathname !== "/api/readFile") {
 return false;
 }

 try {
 const rawBody = (await readJsonBody(req)) as ReadFileRequestBody;
 ctx.config.logger?.info({ rawBody }, "[ReadFile] POST /api/readFile");
 const result = await doReadFile(rawBody, ctx.config);
 sendJson(res,200, result);
 return true;
 } catch (error) {
 ctx.config.logger?.error({ error }, "ReadFile POST route error");
 sendJson(res,400, {
 error: "Invalid JSON body",
 details: error instanceof Error ? error.message : "Unknown error",
 });
 return true;
 }
}
