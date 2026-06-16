import type { IncomingMessage, ServerResponse } from "node:http";
import type { FolderRenameRequestBody } from "@smm/core/types";
import { doRenameFolder } from "../renameFolder.ts";
import { readJsonBody, sendJson } from "../http.ts";
import type { RouteContext } from "../types.ts";

export async function handleRenameFolderPost(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RouteContext,
): Promise<boolean> {
  if (req.method !== "POST" || ctx.url.pathname !== "/api/renameFolder") {
    return false;
  }

  try {
    const rawBody = (await readJsonBody(req)) as FolderRenameRequestBody;
    ctx.config.logger?.info(
      { from: rawBody.from, to: rawBody.to },
      "[RenameFolder] POST /api/renameFolder",
    );
    const result = await doRenameFolder(rawBody, ctx.config);
    sendJson(res, 200, result);
    return true;
  } catch (error) {
    ctx.config.logger?.error({ error }, "[RenameFolder] route error");
    sendJson(res, 200, {
      error: "Unexpected Error: Failed to process rename folder request",
      details: error instanceof Error ? error.message : "Unknown error",
    });
    return true;
  }
}
