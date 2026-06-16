import type { IncomingMessage, ServerResponse } from "node:http";
import { createEmptyListFilesInMediaFolderData } from "@smm/core/ai-tool/buildListFilesInMediaFolderResponse";
import { doListFilesInMediaFolder } from "../listFilesInMediaFolder.ts";
import { readJsonBody, sendJson } from "../http.ts";
import type { RouteContext } from "../types.ts";

export async function handleListFilesInMediaFolderPost(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RouteContext,
): Promise<boolean> {
  if (req.method !== "POST" || ctx.url.pathname !== "/api/listFilesInMediaFolder") {
    return false;
  }

  try {
    const rawBody = await readJsonBody(req);
    ctx.config.logger?.info(
      { rawBody },
      "[ListFilesInMediaFolder] POST /api/listFilesInMediaFolder",
    );
    const result = await doListFilesInMediaFolder(rawBody, ctx.config);
    sendJson(res, 200, result);
    return true;
  } catch (error) {
    ctx.config.logger?.error({ error }, "[ListFilesInMediaFolder] route error");
    sendJson(res, 200, {
      ...createEmptyListFilesInMediaFolderData(),
      error: `Unexpected Error: ${
        error instanceof Error
          ? error.message
          : "Failed to process listFilesInMediaFolder request"
      }`,
    });
    return true;
  }
}
