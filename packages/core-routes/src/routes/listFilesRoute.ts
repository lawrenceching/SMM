import type { IncomingMessage, ServerResponse } from "node:http";
import type { ListFilesRequestBody } from "@smm/core/types";
import { doListFiles } from "../listFiles.ts";
import { parseBooleanQuery, readJsonBody, sendJson } from "../http.ts";
import type { RouteContext } from "../types.ts";

const emptyListFilesResponse = {
  data: { path: "", items: [], size: 0 },
};

export async function handleListFilesGet(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RouteContext,
): Promise<boolean> {
  if (req.method !== "GET" || ctx.url.pathname !== "/api/listFiles") {
    return false;
  }

  const query = ctx.url.searchParams;
  ctx.config.logger?.info({ query: Object.fromEntries(query) }, "[ListFiles] GET /api/listFiles");

  try {
    const body: ListFilesRequestBody = {
      path: query.get("path") ?? "",
    };

    const onlyFiles = parseBooleanQuery(query.get("onlyFiles"));
    if (onlyFiles !== undefined) {
      body.onlyFiles = onlyFiles;
    }
    const onlyFolders = parseBooleanQuery(query.get("onlyFolders"));
    if (onlyFolders !== undefined) {
      body.onlyFolders = onlyFolders;
    }
    const includeHiddenFiles = parseBooleanQuery(query.get("includeHiddenFiles"));
    if (includeHiddenFiles !== undefined) {
      body.includeHiddenFiles = includeHiddenFiles;
    }
    const recursively = parseBooleanQuery(query.get("recursively"));
    if (recursively !== undefined) {
      body.recursively = recursively;
    }

    const result = await doListFiles(body, ctx.config);
    if (result.error) {
      ctx.config.logger?.info({ body, resultError: result.error }, "[ListFiles] GET result has error");
    }
    sendJson(res, 200, result);
    return true;
  } catch (error) {
    ctx.config.logger?.error({ error }, "ListFiles GET route error");
    sendJson(res, 200, {
      ...emptyListFilesResponse,
      error: `Unexpected Error: ${error instanceof Error ? error.message : "Failed to process list files request"}`,
    });
    return true;
  }
}

export async function handleListFilesPost(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RouteContext,
): Promise<boolean> {
  if (req.method !== "POST" || ctx.url.pathname !== "/api/listFiles") {
    return false;
  }

  try {
    const rawBody = (await readJsonBody(req)) as ListFilesRequestBody;
    ctx.config.logger?.info({ rawBody }, "[ListFiles] POST /api/listFiles");
    const result = await doListFiles(rawBody, ctx.config);
    if (result.error) {
      ctx.config.logger?.info({ rawBody, resultError: result.error }, "[ListFiles] POST result has error");
    }
    sendJson(res, 200, result);
    return true;
  } catch (error) {
    ctx.config.logger?.error({ error }, "ListFiles POST route error");
    sendJson(res, 200, {
      ...emptyListFilesResponse,
      error: `Unexpected Error: ${error instanceof Error ? error.message : "Failed to process list files request"}`,
    });
    return true;
  }
}
