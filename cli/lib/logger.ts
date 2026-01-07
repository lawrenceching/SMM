import pino from 'pino';
import { getLogDir } from '@/utils/config';
import path from 'path';
import { mkdir } from 'fs/promises';

/**
 * Creates a Pino logger instance with appropriate configuration.
 * - console: Logs to console (JSON format)
 * - file: Logs to rotating file with size and time-based rotation
 */
async function createLogger() {
  const logTarget = process.env.LOG_TARGET?.toLowerCase().trim() || 'console';
  const logLevel = process.env.LOG_LEVEL || 'info';
  
  if (logTarget === 'file') {
    // File logging with rotation
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
  } else {
    // Console logging (default)
    return pino({
      level: logLevel,
    });
  }
}

// Create and export the logger instance
export const logger = await createLogger();

// Export a default as well for convenience
export default logger;

