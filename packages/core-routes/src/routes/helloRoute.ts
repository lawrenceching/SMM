import type { IncomingMessage, ServerResponse } from "node:http";
import type { HelloHttpResponseBody } from "@smm/types";
import { doHello } from "../hello.ts";
import { sendJson } from "../http.ts";
import type { RouteContext } from "../types.ts";

export async function handleHelloGet(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RouteContext,
): Promise<boolean> {
  if (req.method !== "GET" || ctx.url.pathname !== "/api/hello") {
    return false;
  }

  if (ctx.config.resolveHello) {
    sendJson(res, 200, ctx.config.resolveHello());
    return true;
  }

  if (ctx.config.hello === undefined) {
    sendJson(res, 200, { error: "hello not configured" });
    return true;
  }

  const result = doHello(ctx.config.hello);
  sendJson(res, 200, result satisfies HelloHttpResponseBody);
  return true;
}

/** @deprecated Use handleHelloGet */
export const handleHelloPost = handleHelloGet;
