import 'dotenv/config';
import {
  applyTmdbTlsDevBypassToProcessIfEnabled,
  trustAllTmdbCertEnabled,
} from '@/utils/tmdbTls';
import { Server } from './server';
import { getUserDataDir, getLogDir, getAppDataDir } from '@/utils/config';
import { CommandLogCleaner } from '@/utils/CommandLogCleaner';
import { YtdlpCookiesCleaner } from '@/utils/YtdlpCookiesCleaner';
import { registerGracefulShutdown } from '@/utils/gracefulShutdown';
import { cleanupStalePlans, resolveHttpBindAddress } from '@smm/core-routes';
import { getAuthConfig } from '@/utils/authToken';
import { logApplicationConfig } from '@/startup/applicationConfig';
import { resolveHttpPort } from '@/httpPort';
import { mkdir } from 'fs/promises';
import path from 'path';
import { logger } from './lib/logger';

applyTmdbTlsDevBypassToProcessIfEnabled();

// CLI subcommands talk to Core in-process; do not start the HTTP server.
const cliCommands = new Set(['list', 'add', 'addlib', 'show', 'metadata', 'rm', 'config', 'recognize', 'try-to-recognize', 'try-to-rename', 'apply', 'reject', 'plan', 'scrape', 'job', 'rename', 'rename-episode-file', 'hello', 'tmdb', 'tvdb', 'mcp'])
const firstArg = process.argv[2]
const isCliHelp = firstArg === '--help' || firstArg === '-h'
if (firstArg !== undefined && (cliCommands.has(firstArg) || isCliHelp)) {
  const { runCli } = await import('./src/cli/runCli');
  const code = await runCli(process.argv);
  process.exit(code);
}

interface CommandLineArguments {
  staticDir?: string;
  port?: number;
}

// Parse command line arguments
function parseArgs(): CommandLineArguments {
  const args = process.argv.slice(2);
  const result: CommandLineArguments = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--staticDir' && i + 1 < args.length) {
      const value = args[i + 1];
      if (value) {
        result.staticDir = value;
      }
      i++; // Skip the next argument as it's the value
    } else if (args[i] === '--port' && i + 1 < args.length) {
      const value = args[i + 1];
      if (value) {
        const port = parseInt(value, 10);
        if (!isNaN(port)) {
          result.port = port;
        }
      }
      i++; // Skip the next argument as it's the value
    }
  }

  return result;
}

// Parse command line arguments
const args = parseArgs();

const httpPort = args.port ?? resolveHttpPort();
const staticRoot = path.resolve(args.staticDir ?? '../ui/dist');
const authConfig = getAuthConfig();
const httpBind = resolveHttpBindAddress();

logApplicationConfig({
  httpPort,
  httpBind,
  staticRoot,
  auth: authConfig,
});

// Initialize directories
const userDataDir = getUserDataDir();
const appDataDir = getAppDataDir();
const logDir = getLogDir();

await mkdir(userDataDir, { recursive: true });
await mkdir(appDataDir, { recursive: true });
await mkdir(logDir, { recursive: true });

if (trustAllTmdbCertEnabled()) {
  logger.warn(
    'TRUST_ALL_TMDB_CERT is set: TLS verification is disabled for this process (dev only; NODE_TLS_REJECT_UNAUTHORIZED=0)'
  );
}

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

try {
  await server.start();
} catch (error) {
  logger.error({ err: error }, 'CLI failed to start');
  process.exit(1);
}

registerGracefulShutdown({
  stopServer: async () => {
    await server.stop();
  },
});
