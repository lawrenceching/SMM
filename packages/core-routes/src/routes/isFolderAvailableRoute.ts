import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod/v3";
import {
 doIsFolderAvailable,
 type IsFolderAvailableRequestBody,
} from "../isFolderAvailable.ts";
import { readJsonBody, sendJson } from "../http.ts";
import type { RouteContext } from "../types.ts";

const isFolderAvailableRequestSchema = z.object({
 path: z.string().min(1, "path is required"),
});

/**
 * Node `http` handler for `POST /api/isFolderAvailable`.
 *
 * Validation is performed here (not delegated to `doIsFolderAvailable`)
 * so we can return HTTP400 with the issue list, matching the prior
 * Hono behavior. On success, calls `doIsFolderAvailable` and writes
 * the `{ available }` JSON response.
 */
export async function handleIsFolderAvailablePost(
 req: IncomingMessage,
 res: ServerResponse,
 ctx: RouteContext,
): Promise<boolean> {
 if (req.method !== "POST" || ctx.url.pathname !== "/api/isFolderAvailable") {
 return false;
 }

 try {
 const rawBody = (await readJsonBody(req)) as IsFolderAvailableRequestBody;
 const validationResult = isFolderAvailableRequestSchema.safeParse(rawBody);
 if (!validationResult.success) {
 sendJson(res,400, {
 error: "Validation failed",
 details: validationResult.error.issues.map((issue) => ({
 path: issue.path.join("."),
 message: issue.message,
 })),
 });
 return true;
 }

 const result = await doIsFolderAvailable(rawBody, ctx.config);
 sendJson(res,200, result);
 return true;
 } catch (error) {
 ctx.config.logger?.debug({ error }, "[IsFolderAvailable] invalid JSON");
 sendJson(res,400, { error: "Invalid JSON body" });
 return true;
 }
}
