import type { IncomingMessage, ServerResponse } from "node:http";
import { createEmptyGetEpisodesData } from "@smm/core/ai-tool/buildGetEpisodesResponse";
import { doGetEpisodes } from "../getEpisodes.ts";
import { readJsonBody, sendJson } from "../http.ts";
import type { RouteContext } from "../types.ts";

export async function handleGetEpisodesPost(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RouteContext,
): Promise<boolean> {
  if (req.method !== "POST" || ctx.url.pathname !== "/api/getEpisodes") {
    return false;
  }

  try {
    const rawBody = await readJsonBody(req);
    ctx.config.logger?.info({ rawBody }, "[GetEpisodes] POST /api/getEpisodes");
    const result = await doGetEpisodes(rawBody, ctx.config);
    sendJson(res, 200, result);
    return true;
  } catch (error) {
    ctx.config.logger?.error({ error }, "[GetEpisodes] route error");
    sendJson(res, 200, {
      ...createEmptyGetEpisodesData(),
      error: `Unexpected Error: ${
        error instanceof Error ? error.message : "Failed to process getEpisodes request"
      }`,
    });
    return true;
  }
}
