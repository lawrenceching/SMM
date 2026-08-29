import http from "node:http";
import {
  createCoreRoutesRequestHandler,
  type CoreRoutesAuthConfig,
  type CoreRoutesLogger,
} from "@smm/core-routes";
import { buildAllowlist } from "@/utils/buildAllowlist";
import { getUserDataDir } from "@/utils/config";
import { buildHelloHttpResponse } from "@/cli/helloHttp";
import { logger } from "../lib/logger";
import { broadcast } from "@/utils/socketIO";
import { resolveCoreRoutesPort } from "@/coreRoutesPort";

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
  const allowlist = await buildAllowlist();
  const appDataDir = getUserDataDir();
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

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => resolve());
  });

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
