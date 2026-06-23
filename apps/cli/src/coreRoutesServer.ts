import http from "node:http";
import {
  createCoreRoutesRequestHandler,
  type CoreRoutesAuthConfig,
  type CoreRoutesLogger,
} from "@smm/core-routes";
import { buildAllowlist } from "@/utils/buildAllowlist";
import { getAppDataDir } from "@/utils/config";
import { buildHelloOptions } from "../tasks/HelloTask";
import { logger } from "../lib/logger";
import { broadcast } from "@/utils/socketIO";

const DEFAULT_PORT = 3001;

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
  const port = parseInt(process.env.CORE_ROUTES_PORT ?? String(DEFAULT_PORT), 10);
  const allowlist = await buildAllowlist();
  const appDataDir = getAppDataDir();
  const helloOptions = { ...buildHelloOptions(null), coreRoutesPort: port };
  const handler = createCoreRoutesRequestHandler(
    {
      allowlist,
      logger: createCoreRoutesLogger(),
      hello: helloOptions,
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
