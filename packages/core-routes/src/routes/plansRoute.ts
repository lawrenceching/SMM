import type { IncomingMessage, ServerResponse } from "node:http";
import { readJsonBody, sendJson } from "../http.ts";
import type { RouteContext } from "../types.ts";
import { doCreatePlan, doGetPlans, doUpdatePlan } from "../plansApi.ts";

export async function handleGetPlansPost(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RouteContext,
): Promise<boolean> {
  if (req.method !== "POST" || ctx.url.pathname !== "/api/getPlans") {
    return false;
  }
  try {
    const body = await readJsonBody(req);
    const result = await doGetPlans(body, ctx.config);
    sendJson(res, 200, result);
  } catch (error) {
    ctx.config.logger?.error({ error }, "[GetPlans] route error");
    sendJson(res, 200, {
      error: `Error Reason: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
  return true;
}

export async function handleCreatePlanPost(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RouteContext,
): Promise<boolean> {
  if (req.method !== "POST" || ctx.url.pathname !== "/api/createPlan") {
    return false;
  }
  try {
    const body = await readJsonBody(req);
    const result = await doCreatePlan(body, ctx.config);
    sendJson(res, 200, result);
  } catch (error) {
    ctx.config.logger?.error({ error }, "[CreatePlan] route error");
    sendJson(res, 200, {
      error: `Error Reason: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
  return true;
}

export async function handleUpdatePlanPost(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RouteContext,
): Promise<boolean> {
  if (req.method !== "POST" || ctx.url.pathname !== "/api/updatePlan") {
    return false;
  }
  try {
    const body = await readJsonBody(req);
    const result = await doUpdatePlan(body, ctx.config);
    sendJson(res, 200, result);
  } catch (error) {
    ctx.config.logger?.error({ error }, "[UpdatePlan] route error");
    sendJson(res, 200, {
      error: `Error Reason: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
  return true;
}
