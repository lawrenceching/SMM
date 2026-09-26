import type { IncomingMessage, ServerResponse } from "node:http";
import {
  createCoreRoutesRequestHandler,
  type ChatConfig,
  type CoreRoutesAuthConfig,
  type CoreRoutesLogger,
} from "@smm/core-routes";
import { buildAllowlist } from "@/utils/buildAllowlist";
import { getAppDataDir, getUserDataDir, getUserConfig } from "@/utils/config";
import { buildHelloHttpResponse } from "@/cli/helloHttp";
import { logger } from "../lib/logger";
import { acknowledge, broadcast } from "@/utils/socketIO";
import { createAIProvider } from "../lib/ai-provider";
import { getBunMcpLifecycleManager } from "@/mcp/bunMcpLifecycleManager";
import { getCore } from "@/core/getCore";

function createCoreRoutesLogger(): CoreRoutesLogger {
  return {
    debug: (obj, msg) => logger.debug(obj, msg),
    info: (obj, msg) => logger.info(obj, msg),
    warn: (obj, msg) => logger.warn(obj, msg),
    error: (obj, msg) => logger.error(obj, msg),
  };
}

function buildCliChatConfig(): ChatConfig {
  return {
    appDataDir: getAppDataDir(),
    userDataDir: getUserDataDir(),
    logger: createCoreRoutesLogger(),
    createAIProvider: (userConfig) => createAIProvider(userConfig),
    getUserConfig: () => getUserConfig(),
    acknowledge: (message, timeoutMs) => acknowledge(message as never, timeoutMs),
    broadcast: (message) => broadcast(message as never),
    toolsExtra: {
      renameEpisodeFile: (input) => getCore().renameEpisodeFile(input),
      applyRenameEpisodePlan: (plan) => getCore().applyPlan(plan),
      applyRecognizeEpisodePlan: (plan) => getCore().applyPlan(plan),
      scrapeFolder: (path, options) => getCore().scrapeFolder(path, options),
      getJob: (id) => getCore().getJob(id),
      tmdb: {
        searchInTmdb: (keyword, options) => getCore().searchInTmdb(keyword, options),
        getMovieInTmdb: (id, options) => getCore().getMovieInTmdb(id, options),
        getTvShowInTmdb: (id, options) => getCore().getTvShowInTmdb(id, options),
      },
      tvdb: {
        searchInTvdb: (keyword, options) => getCore().searchInTvdb(keyword, options),
        getMovieInTvdb: (id, options) => getCore().getMovieInTvdb(id, options),
        getTvShowInTvdb: (id, options) => getCore().getTvShowInTvdb(id, options),
        getTvdbLanguages: (options) => getCore().getTvdbLanguages(options),
      },
    },
  };
}

export type HelloResolverHolder = {
  resolve: () => ReturnType<typeof buildHelloHttpResponse>;
};

/**
 * Shared core-routes handler for the unified HTTP server.
 * Host attaches via {@link isCoreRoute} dispatch; does not listen.
 */
export async function createCliCoreRoutesHandler(
  httpPort: number,
  helloHolder: HelloResolverHolder,
  auth?: CoreRoutesAuthConfig,
): Promise<(req: IncomingMessage, res: ServerResponse) => void> {
  const allowlist = await buildAllowlist();
  const appDataDir = getAppDataDir();

  return createCoreRoutesRequestHandler(
    {
      allowlist,
      resolveAllowlist: buildAllowlist,
      logger: createCoreRoutesLogger(),
      resolveHello: () => helloHolder.resolve(),
      appDataDir,
      broadcast: (message) => broadcast(message),
      auth,
      chat: buildCliChatConfig(),
      mcp: { manager: getBunMcpLifecycleManager() },
    },
    { fallbackPort: httpPort },
  );
}
