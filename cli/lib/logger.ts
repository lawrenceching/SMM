import pino from 'pino';
import { getLogDir } from '@/utils/config';
import path from 'path';
import { mkdir } from 'fs/promises';

const isDevelopment = process.env.NODE_ENV !== 'production';
const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

/**
 * Creates a Pino logger instance with appropriate configuration for the current environment.
 * - Development: Logs to console (JSON format)
 * - Production: Logs to rotating file with size and time-based rotation
 */
async function createLogger() {
  if (isDevelopment) {
    // Development mode: console logging (JSON format)
    const logDir = getLogDir();
    console.log(`📝 Log directory: ${logDir} (logs printed to console in development mode)`);
    
    return pino({
      level: logLevel,
    });
  } else {
    // Production mode: file logging with rotation
    const logDir = getLogDir();
    
    // Ensure log directory exists
    await mkdir(logDir, { recursive: true });
    
    const logFilePath = path.join(logDir, 'smm.log');
    
    // Print log directory location at startup (use console since logger may not be ready yet)
    console.log(`📝 Log directory: ${logDir}`);
    console.log(`📄 Log file: ${logFilePath}`);
    
    return pino({
      level: logLevel,
      transport: {
        target: 'pino-roll',
        options: {
          file: logFilePath,
          frequency: 'daily',         // Rotate daily at midnight
          size: '10m',                 // Max 10MB per file
          limit: {
            count: 10                  // Keep last 10 files (~100MB total)
          },
          mkdir: true,                 // Create directory if needed
        }
      },
    });
  }
}

// Create and export the logger instance
export const logger = await createLogger();

// Export a default as well for convenience
export default logger;

