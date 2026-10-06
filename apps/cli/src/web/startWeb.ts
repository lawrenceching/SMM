import { mkdir } from 'fs/promises';
import path from 'path';
import {
  Server,
  logger,
  logApplicationConfig,
  registerGracefulShutdown,
  resolveHttpPort,
  getAppDataDir,
  getLogDir,
  getUserDataDir,
} from '@smm/server';
import { cleanupStalePlans, resolveHttpBindAddress } from '@smm/core-routes';
import { CommandLogCleaner } from '@/utils/CommandLogCleaner';
import { YtdlpCookiesCleaner } from '@/utils/YtdlpCookiesCleaner';
import { getAuthConfig } from '@/utils/authToken';

export interface StartWebOptions {
  staticDir?: string;
  port?: number;
}

/** Start the SMM HTTP server (the `smm web` command body). */
export async function startWeb(options: StartWebOptions = {}): Promise<void> {
  const httpPort = options.port ?? resolveHttpPort();
  const staticRoot = path.resolve(options.staticDir ?? '../ui/dist');
  const authConfig = getAuthConfig();
  const httpBind = resolveHttpBindAddress();

  logApplicationConfig({
    httpPort,
    httpBind,
    staticRoot,
    auth: authConfig,
  });

  const userDataDir = getUserDataDir();
  const appDataDir = getAppDataDir();
  const logDir = getLogDir();

  await mkdir(userDataDir, { recursive: true });
  await mkdir(appDataDir, { recursive: true });
  await mkdir(logDir, { recursive: true });

  const cookiesCleaner = new YtdlpCookiesCleaner({ userDataDir });
  try {
    const cleaner = new CommandLogCleaner({ logDir, maxLogDirs: 100 });
    await cleaner.clean();
    await cookiesCleaner.cleanAll();
    await cleanupStalePlans(userDataDir, undefined, logger);
    logger.info('cleanup job succeeded');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.error({ err: error }, `cleanup job failed: ${reason}`);
    throw error;
  }

  const server = new Server({
    port: httpPort,
    root: staticRoot,
    auth: authConfig,
    beforeStop: async () => {
      const result = await cookiesCleaner.cleanAll();
      logger.info(result, 'yt-dlp cookies temp cleanup on shutdown');

      const preparingPlansRemoved = await cleanupStalePlans(userDataDir, undefined, logger);
      if (preparingPlansRemoved > 0) {
        logger.info(
          { count: preparingPlansRemoved },
          '[cleanup] stale preparing plan files cleaned up on shutdown',
        );
      }
    },
  });

  await server.start();
  logger.info(
    `SMM is up and running, please open "http://127.0.0.1:${httpPort}?token=${authConfig.token}" in browser`,
  );

  registerGracefulShutdown({
    stopServer: async () => {
      await server.stop();
    },
  });
}
