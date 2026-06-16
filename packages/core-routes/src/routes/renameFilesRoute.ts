import type { IncomingMessage, ServerResponse } from "node:http";
import type { RenameFilesRequestBody } from "@smm/core/types";
import { doRenameFiles } from "../renameFiles.ts";
import { readJsonBody, sendJson } from "../http.ts";
import type { RouteContext } from "../types.ts";

export async function handleRenameFilesPost(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RouteContext,
): Promise<boolean> {
  if (req.method !== "POST" || ctx.url.pathname !== "/api/renameFiles") {
    return false;
  }

  try {
    const rawBody = (await readJsonBody(req)) as RenameFilesRequestBody;
    const clientId = req.headers.clientid ?? req.headers.clientId;
    const headerClientId = typeof clientId === "string" ? clientId : undefined;

    ctx.config.logger?.info(
      { fileCount: rawBody.files?.length, traceId: rawBody.traceId },
      "[RenameFiles] POST /api/renameFiles",
    );

    const result = await doRenameFiles(rawBody, ctx.config, headerClientId);
    sendJson(res, 200, result);
    return true;
  } catch (error) {
    ctx.config.logger?.error({ error }, "[RenameFiles] route error");
    sendJson(res, 200, {
      error: `Unexpected Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
    return true;
  }
}
