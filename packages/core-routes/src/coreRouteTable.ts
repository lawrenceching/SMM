import type { RouteHandler } from "./types.ts";
import { handleListFilesGet, handleListFilesPost } from "./routes/listFilesRoute.ts";
import { handleHelloGet } from "./routes/helloRoute.ts";
import { handleIsFolderAvailablePost } from "./routes/isFolderAvailableRoute.ts";
import { handleReadFilePost } from "./routes/readFileRoute.ts";
import { handleWriteFilePost } from "./routes/writeFileRoute.ts";
import { handleDeleteFilePost } from "./routes/deleteFileRoute.ts";
import { handleDeleteFolderPost } from "./routes/deleteFolderRoute.ts";
import { handleGetEpisodesPost } from "./routes/getEpisodesRoute.ts";
import { handleListFilesInMediaFolderPost } from "./routes/listFilesInMediaFolderRoute.ts";
import { handleRenameFolderPost } from "./routes/renameFolderRoute.ts";
import { handleRenameFilesPost } from "./routes/renameFilesRoute.ts";
import { handleDownloadImageGet } from "./routes/downloadImageRoute.ts";
import { handleDownloadImageAsFilePost } from "./routes/downloadImageAsFileRoute.ts";
import { handleReadImagePost } from "./routes/readImageRoute.ts";
import { handleDiscoverGet } from "./routes/discoverRoute.ts";
import { handleChatPost } from "./chat.ts";
import {
  handleMcpStartPut,
  handleMcpStatusGet,
  handleMcpStopPut,
} from "./routes/mcpLifecycleRoute.ts";
import {
  handleMcpGetServerStatusGet,
  handleMcpStartPost,
  handleMcpStopPost,
} from "./routes/mcpServerRpcRoute.ts";
import {
  handleCreatePlanPost,
  handleGetPlanByIdPost,
  handleGetPlansPost,
  handleUpdatePlanPost,
} from "./routes/plansRoute.ts";
import { handleGetUserConfigPost, handlePatchUserConfigPost } from "./routes/userConfigRoute.ts";

/**
 * One shared public HTTP route: method + path + handler.
 * Hosts (cli / ohos) use {@link isCoreRoute} for explicit dispatch; this list
 * is the single source of truth — adding an API means appending here.
 */
export type CoreRoute = {
  method: string;
  path: string;
  handle: RouteHandler;
};

export const coreRoutes: readonly CoreRoute[] = [
  { method: "GET", path: "/api/listFiles", handle: handleListFilesGet },
  { method: "POST", path: "/api/listFiles", handle: handleListFilesPost },
  { method: "POST", path: "/api/writeFile", handle: handleWriteFilePost },
  { method: "GET", path: "/api/hello", handle: handleHelloGet },
  { method: "POST", path: "/api/isFolderAvailable", handle: handleIsFolderAvailablePost },
  { method: "POST", path: "/api/getEpisodes", handle: handleGetEpisodesPost },
  {
    method: "POST",
    path: "/api/listFilesInMediaFolder",
    handle: handleListFilesInMediaFolderPost,
  },
  { method: "POST", path: "/api/rename-folder", handle: handleRenameFolderPost },
  { method: "POST", path: "/api/renameFiles", handle: handleRenameFilesPost },
  { method: "POST", path: "/api/readFile", handle: handleReadFilePost },
  { method: "POST", path: "/api/deleteFile", handle: handleDeleteFilePost },
  { method: "POST", path: "/api/deleteFolder", handle: handleDeleteFolderPost },
  { method: "GET", path: "/api/image", handle: handleDownloadImageGet },
  { method: "POST", path: "/api/downloadImage", handle: handleDownloadImageAsFilePost },
  { method: "POST", path: "/api/readImage", handle: handleReadImagePost },
  { method: "GET", path: "/api/discover", handle: handleDiscoverGet },
  { method: "POST", path: "/api/chat", handle: handleChatPost },
  { method: "GET", path: "/api/get-mcp-server-status", handle: handleMcpGetServerStatusGet },
  { method: "POST", path: "/api/start-mcp-server", handle: handleMcpStartPost },
  { method: "POST", path: "/api/stop-mcp-server", handle: handleMcpStopPost },
  { method: "PUT", path: "/api/mcp/start", handle: handleMcpStartPut },
  { method: "PUT", path: "/api/mcp/stop", handle: handleMcpStopPut },
  { method: "GET", path: "/api/mcp/status", handle: handleMcpStatusGet },
  { method: "POST", path: "/api/getPlans", handle: handleGetPlansPost },
  { method: "POST", path: "/api/getPlanById", handle: handleGetPlanByIdPost },
  { method: "POST", path: "/api/createPlan", handle: handleCreatePlanPost },
  { method: "POST", path: "/api/updatePlan", handle: handleUpdatePlanPost },
  { method: "POST", path: "/api/getUserConfig", handle: handleGetUserConfigPost },
  { method: "POST", path: "/api/patchUserConfig", handle: handlePatchUserConfigPost },
];

const coreRouteKeySet: ReadonlySet<string> = new Set(
  coreRoutes.map((route) => coreRouteKey(route.method, route.path)),
);

export function coreRouteKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`;
}

/** True when method+path is a shared core-routes public API. */
export function isCoreRoute(method: string, pathname: string): boolean {
  return coreRouteKeySet.has(coreRouteKey(method, pathname));
}

/** Handler list derived from {@link coreRoutes} (order preserved). */
export const coreRouteHandlers: RouteHandler[] = coreRoutes.map((route) => route.handle);
