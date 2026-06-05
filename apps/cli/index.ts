import 'dotenv/config';
import {
  applyTmdbTlsDevBypassToProcessIfEnabled,
  trustAllTmdbCertEnabled,
} from '@/utils/tmdbTls';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { Server } from './server';
import { getUserDataDir, getLogDir, getAppDataDir } from '@/utils/config';
import { CommandLogCleaner } from '@/utils/CommandLogCleaner';
import { YtdlpCookiesCleaner } from '@/utils/YtdlpCookiesCleaner';
import { registerGracefulShutdown } from '@/utils/gracefulShutdown';
import { mkdir } from 'fs/promises';
import { logger } from './lib/logger';

applyTmdbTlsDevBypassToProcessIfEnabled();

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

  logger.info(`staticDir: ${result.staticDir}`);
  logger.info(`port: ${result.port}`);
  
  return result;
}

// Create a custom provider with your baseURL and API key
const customProvider = createOpenAICompatible({
  name: 'DeepSeek',
  baseURL: 'https://api.deepseek.com/v1', // Your custom base URL
  apiKey: '', // Your API key
});

// Parse command line arguments
const args = parseArgs();

// Initialize directories
const userDataDir = getUserDataDir();
const appDataDir = getAppDataDir();
const logDir = getLogDir();

// Create directories using fs/promises (optimized in Bun, simpler than Node.js)
await mkdir(userDataDir, { recursive: true });
await mkdir(appDataDir, { recursive: true });
await mkdir(logDir, { recursive: true });

// Log startup information
logger.info('=== Application Startup ===');
if (trustAllTmdbCertEnabled()) {
  logger.warn(
    'TRUST_ALL_TMDB_CERT is set: TLS verification is disabled for this process (dev only; NODE_TLS_REJECT_UNAUTHORIZED=0)'
  );
}
logger.info(`User data directory: ${userDataDir}`);
logger.info(`App data directory: ${appDataDir}`);
logger.info(`Log directory: ${logDir}`);

// Clean up old command execution log directories
const cleaner = new CommandLogCleaner({ logDir, maxLogDirs: 100 });
const cleanResult = await cleaner.clean();
logger.info(
  { removed: cleanResult.removed, remaining: cleanResult.remaining },
  'Command log cleanup result',
);

const cookiesCleaner = new YtdlpCookiesCleaner({ userDataDir });
const cookiesStartupResult = await cookiesCleaner.cleanAll();
logger.info(cookiesStartupResult, 'yt-dlp cookies temp cleanup on startup');

// Create and start the server
const server = new Server({
  port: args.port ?? (process.env.PORT ? parseInt(process.env.PORT) : 30000),
  root: args.staticDir ?? '../ui/dist',
  beforeStop: async () => {
    const result = await cookiesCleaner.cleanAll();
    logger.info(result, 'yt-dlp cookies temp cleanup on shutdown');
  },
});

registerGracefulShutdown({
  stopServer: () => server.stop(),
});

server.start();