import type { IncomingMessage, ServerResponse } from "node:http";
import type http from "node:http";
import { createRequestUrl, sendJson } from "./http.ts";
import { coreRoutes } from "./coreRouteTable.ts";
import { enforceCoreRoutesAuth } from "./auth.ts";
import type { CoreRoutesConfig, RouteContext } from "./types.ts";

export {
  coreRouteHandlers,
  coreRoutes,
  coreRouteKey,
  isCoreRoute,
  type CoreRoute,
} from "./coreRouteTable.ts";

export function createCoreRoutesRequestHandler(
  config: CoreRoutesConfig,
  options: { fallbackPort?: number } = {},
): (req: IncomingMessage, res: ServerResponse) => void {
  const fallbackPort = options.fallbackPort ?? 3001;

  return (req, res) => {
    void handleCoreRoutesRequest(req, res, config, fallbackPort);
  };
}

export async function handleCoreRoutesRequest(
  req: IncomingMessage,
  res: ServerResponse,
  config: CoreRoutesConfig,
  fallbackPort: number = 3001,
): Promise<void> {
  const url = createRequestUrl(req, fallbackPort);
  if (enforceCoreRoutesAuth(req, res, config)) {
    return;
  }
  const ctx: RouteContext = { config, url };
  const method = req.method ?? "GET";

  for (const route of coreRoutes) {
    if (route.method !== method || route.path !== url.pathname) {
      continue;
    }
    const handled = await route.handle(req, res, ctx);
    if (handled) {
      return;
    }
  }

  sendJson(res, 404, { error: `Not found: ${method} ${url.pathname}` });
}

export function registerCoreRoutes(server: http.Server, config: CoreRoutesConfig): void {
  const fallbackPort =
    typeof server.address() === "object" && server.address() !== null
      ? (server.address() as { port: number }).port
      : 3001;

  server.on("request", createCoreRoutesRequestHandler(config, { fallbackPort }));
}

export { handleListFilesGet, handleListFilesPost } from "./routes/listFilesRoute.ts";
export { handleWriteFilePost } from "./routes/writeFileRoute.ts";
export { handleHelloGet } from "./routes/helloRoute.ts";
export { handleIsFolderAvailablePost } from "./routes/isFolderAvailableRoute.ts";
export { handleReadFilePost } from "./routes/readFileRoute.ts";
export { handleDeleteFilePost } from "./routes/deleteFileRoute.ts";
export { handleDeleteFolderPost } from "./routes/deleteFolderRoute.ts";
export { handleGetEpisodesPost } from "./routes/getEpisodesRoute.ts";
export { handleListFilesInMediaFolderPost } from "./routes/listFilesInMediaFolderRoute.ts";
export { handleRenameFolderPost } from "./routes/renameFolderRoute.ts";
export { handleRenameFilesPost } from "./routes/renameFilesRoute.ts";
export { handleDownloadImageGet } from "./routes/downloadImageRoute.ts";
export { handleDownloadImageAsFilePost } from "./routes/downloadImageAsFileRoute.ts";
export { handleReadImagePost } from "./routes/readImageRoute.ts";
export { handleDiscoverGet } from "./routes/discoverRoute.ts";
export {
  handleGetPlansPost,
  handleGetPlanByIdPost,
  handleCreatePlanPost,
  handleUpdatePlanPost,
} from "./routes/plansRoute.ts";
export { handleGetUserConfigPost, handlePatchUserConfigPost } from "./routes/userConfigRoute.ts";
export {
  doGetPlans,
  doGetPlanById,
  doCreatePlan,
  doUpdatePlan,
  type GetPlansResponseBody,
  type GetPlanByIdResponseBody,
  type CreatePlanResponseBody,
  type UpdatePlanResponseBody,
} from "./plansApi.ts";
export { doDownloadImage } from "./downloadImage.ts";
export { doDownloadImageAsFile } from "./downloadImageAsFile.ts";
export { doReadImage } from "./readImage.ts";
export { doRenameFiles } from "./renameFiles.ts";
export {
  doGetEpisodes,
  type GetEpisodesRequestBody,
} from "./getEpisodes.ts";
export {
  doListFilesInMediaFolder,
  type ListFilesInMediaFolderRequestBody,
} from "./listFilesInMediaFolder.ts";
export { doRenameFolder } from "./renameFolder.ts";
