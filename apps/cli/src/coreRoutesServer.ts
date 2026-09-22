import http from "node:http";
import {
  createCoreRoutesRequestHandler,
  type CoreRoutesAuthConfig,
  type CoreRoutesLogger,
} from "@smm/core-routes";
import { buildAllowlist } from "@/utils/buildAllowlist";
import { getAppDataDir } from "@/utils/config";
import { buildHelloHttpResponse } from "@/cli/helloHttp";
import { logger } from "../lib/logger";
import { broadcast } from "@/utils/socketIO";
import { resolveCoreRoutesPort } from "@/coreRoutesPort";
import { startupDiag } from "@/utils/startupDiag";

function createCoreRoutesLogger(): CoreRoutesLogger {
  return {
    debug: (obj, msg) => logger.debug(obj, msg),
    info: (obj, msg) => logger.info(obj, msg),
    warn: (obj, msg) => logger.warn(obj, msg),
    error: (obj, msg) => logger.error(obj, msg),
  };
}

export async function startCoreRoutesServer(
  auth?: CoreRoutesAuthConfig,
): Promise<http.Server> {
  const port = resolveCoreRoutesPort();
  startupDiag("core-routes-build-allowlist-begin", { port });
  const allowlist = await buildAllowlist();
  startupDiag("core-routes-build-allowlist-done", {
    port,
    allowlistSize: allowlist.length,
  });
  const appDataDir = getAppDataDir();
  const handler = createCoreRoutesRequestHandler(
    {
      allowlist,
      resolveAllowlist: buildAllowlist,
      logger: createCoreRoutesLogger(),
      resolveHello: () => buildHelloHttpResponse(null, port),
      appDataDir,
      broadcast: (message) => broadcast(message),
      auth,
    },
    { fallbackPort: port },
  );

  const server = http.createServer(handler);

  startupDiag("core-routes-listen-begin", { port });
  await new Promise<void>((resolve, reject) => {
    server.once("error", (err) => {
      startupDiag("core-routes-listen-error", {
        port,
        error: err.message,
        code: "code" in err ? String(err.code) : null,
      });
      reject(err);
    });
    server.listen(port, () => resolve());
  });
  startupDiag("core-routes-listen-done", { port });

  logger.info(`core-routes HTTP server running on http://localhost:${port}`);
  return server;
}

export function stopCoreRoutesServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      logger.info("core-routes HTTP server stopped");
      resolve();
    });
  });
}
