import pino from 'pino';
import { getLogDir } from '@/utils/config';
import path from 'path';
import { mkdir } from 'fs/promises';
import type { Context } from 'hono';

/**
 * Creates a Pino logger instance with appropriate configuration.
 * - console: Logs to console (JSON format)
 * - file: Logs to file using synchronous destination (compatible with Bun compiled executables)
 * 
 * Note: We use pino.destination() instead of pino.transport() because transports
 * use worker threads which don't work in Bun's compiled executables.
 */
async function createLogger() {
  const logTarget = process.env.LOG_TARGET?.toLowerCase().trim() || 'console';
  const logLevel = process.env.LOG_LEVEL || 'info';
  
  if (logTarget === 'file') {
    // File logging using synchronous destination
    // This works in Bun compiled executables unlike pino.transport()
    const logDir = getLogDir();
    
    // Ensure log directory exists
    await mkdir(logDir, { recursive: true });
    
    const logFilePath = path.join(logDir, 'smm.log');
    
    // Print log directory location at startup (use console since logger may not be ready yet)
    console.log(`📝 Log directory: ${logDir}`);
    console.log(`📄 Log file: ${logFilePath}`);
    
    // Use pino.destination() for synchronous file writing
    // This is compatible with Bun compiled executables
    const destination = pino.destination({
      dest: logFilePath,
      append: true,
      sync: false, // Use async writing for better performance
    });
    
    return pino({
      level: logLevel,
    }, destination);
  } else {
    // Console logging (default)
    return pino({
      level: logLevel,
    });
  }
}


/**
 * Logs incoming HTTP request.
 * In debug mode, includes the request body; otherwise only logs method and URL.
 */
export function logHttpIn(c: Context, body?: unknown) {
  if (logger.isLevelEnabled('debug')) {
    logger.debug({
      method: c.req.method,
      url: c.req.url,
      body
    }, 'HTTP request received');
  } else {
    logger.info({
      method: c.req.method,
      url: c.req.url,
    }, 'HTTP request received');
  }
}

/**
 * Logs outgoing HTTP response.
 * In debug mode, includes the response body; otherwise only logs method, URL, and status code.
 * Automatically determines error state by checking for 'error' property in body or status code >= 400.
 */
export function logHttpOut(c: Context, body: unknown, statusCode: number = 200) {
  // Check if response is an error
  const isError = statusCode >= 400 || (typeof body === 'object' && body !== null && 'error' in body);
  
  const logData: Record<string, unknown> = {
    method: c.req.method,
    url: c.req.url,
    statusCode,
  };

  if (logger.isLevelEnabled('debug')) {
    logData.body = body;
  }

  if (isError) {
    logger.error(logData, 'HTTP response sent');
  } else {
    logger.info(logData, 'HTTP response sent');
  }
}

// Create and export the logger instance
export const logger = await createLogger();

// Export a default as well for convenience
export default logger;
