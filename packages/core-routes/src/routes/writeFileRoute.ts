import type { IncomingMessage, ServerResponse } from "node:http";
import type { WriteFileRequestBody } from "@smm/core/types";
import { doWriteFile, isError, ExistedFileError } from "../writeFile.ts";
import { readJsonBody, sendJson } from "../http.ts";
import type { RouteContext } from "../types.ts";

export async function handleWriteFilePost(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RouteContext,
): Promise<boolean> {
  if (req.method !== "POST" || ctx.url.pathname !== "/api/writeFile") {
    return false;
  }

  const traceId = req.headers["x-trace-id"];
  const traceIdStr = typeof traceId === "string" ? traceId : Array.isArray(traceId) ? traceId[0] ?? "" : "";

  try {
    const rawBody = (await readJsonBody(req)) as WriteFileRequestBody;
    ctx.config.logger?.info({ traceId: traceIdStr, rawBody }, "POST /api/writeFile");
    const result = await doWriteFile(rawBody, ctx.config, traceIdStr);

    if (result.error) {
      if (isError(result.error, ExistedFileError)) {
        sendJson(res, 200, result);
        return true;
      }
      sendJson(res, 400, result);
      return true;
    }

    sendJson(res, 200, result);
    return true;
  } catch (error) {
    const respBody = {
      error: "Failed to process write file request",
      details: error instanceof Error ? error.message : "Unknown error",
    };
    sendJson(res, 500, respBody);
    return true;
  }
}
