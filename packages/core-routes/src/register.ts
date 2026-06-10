import type { IncomingMessage, ServerResponse } from "node:http";
import type http from "node:http";
import { createRequestUrl, sendJson } from "./http.ts";
import { handleListFilesGet, handleListFilesPost } from "./routes/listFilesRoute.ts";
import { handleHelloPost } from "./routes/helloRoute.ts";
import { handleWriteFilePost } from "./routes/writeFileRoute.ts";
import type { CoreRoutesConfig, RouteContext, RouteHandler } from "./types.ts";

export const coreRouteHandlers: RouteHandler[] = [
  handleListFilesGet,
  handleListFilesPost,
  handleWriteFilePost,
  handleHelloPost,
];

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
  const ctx: RouteContext = { config, url };

  for (const handler of coreRouteHandlers) {
    const handled = await handler(req, res, ctx);
    if (handled) {
      return;
    }
  }

  sendJson(res, 404, { error: `Not found: ${req.method ?? "UNKNOWN"} ${url.pathname}` });
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
export { handleHelloPost } from "./routes/helloRoute.ts";
