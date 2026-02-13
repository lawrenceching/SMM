import { generateText } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { Server } from './server';
import { executeHelloTask, getAppDataDir } from 'tasks/HelloTask';
import { getUserDataDir, getLogDir } from '@/utils/config';
import { mkdir } from 'fs/promises';
import { logger } from './lib/logger';

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
logger.info(`User data directory: ${userDataDir}`);
logger.info(`App data directory: ${appDataDir}`);
logger.info(`Log directory: ${logDir}`);

// Create and start the server
const server = new Server({
  port: args.port ?? (process.env.PORT ? parseInt(process.env.PORT) : 30000),
  root: args.staticDir ?? '../ui/dist',
});

server.start();