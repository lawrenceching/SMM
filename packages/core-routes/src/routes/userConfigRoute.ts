import type { IncomingMessage, ServerResponse } from "node:http";
import type { PatchUserConfigRequestBody } from "@smm/types";
import { readJsonBody, sendJson } from "../http.ts";
import type { RouteContext } from "../types.ts";
import { doGetUserConfig, doPatchUserConfig } from "../userConfigApi.ts";

export async function handleGetUserConfigPost(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RouteContext,
): Promise<boolean> {
  if (req.method !== "POST" || ctx.url.pathname !== "/api/getUserConfig") {
    return false;
  }

  try {
    const result = await doGetUserConfig(ctx.config);
    sendJson(res, 200, result);
    return true;
  } catch (error) {
    ctx.config.logger?.error({ error }, "GetUserConfig POST route error");
    sendJson(res, 500, {
      error: "Error Reason: Failed to read user config",
    });
    return true;
  }
}

export async function handlePatchUserConfigPost(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RouteContext,
): Promise<boolean> {
  if (req.method !== "POST" || ctx.url.pathname !== "/api/patchUserConfig") {
    return false;
  }

  try {
    const rawBody = (await readJsonBody(req)) as PatchUserConfigRequestBody;
    ctx.config.logger?.info({ rawBody }, "[PatchUserConfig] POST /api/patchUserConfig");
    const result = await doPatchUserConfig(rawBody, ctx.config);
    sendJson(res, 200, result);
    return true;
  } catch (error) {
    ctx.config.logger?.error({ error }, "PatchUserConfig POST route error");
    sendJson(res, 400, {
      error: "Invalid JSON body",
      details: error instanceof Error ? error.message : "Unknown error",
    });
    return true;
  }
}
