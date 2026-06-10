import type { IncomingMessage, ServerResponse } from "node:http";
import { doHello } from "../hello.ts";
import { sendJson } from "../http.ts";
import type { RouteContext } from "../types.ts";

export async function handleHelloPost(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RouteContext,
): Promise<boolean> {
  if (req.method !== "POST" || ctx.url.pathname !== "/api/hello") {
    return false;
  }

  if (ctx.config.hello === undefined) {
    sendJson(res, 200, { error: "hello not configured" });
    return true;
  }

  const result = doHello(ctx.config.hello);
  sendJson(res, 200, result);
  return true;
}
