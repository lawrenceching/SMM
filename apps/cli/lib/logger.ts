import pino from 'pino';
import { getLogDir } from '@/utils/config';
import path from 'path';
import { mkdir } from 'fs/promises';
import type { Context } from 'hono';
import os from 'os';
import { createFrontendLogStream } from '@/utils/FrontendLogFile';
import { initSensitiveStrings, wrapWithMasking } from '@/utils/sensitiveBlacklist';

/**
 * Masks the OS username in a string with asterisks for security.
 * @param msg - The string that may contain the OS username
 * @returns The string with the OS username replaced by '***'
 */
export function maskOsUsername(msg: string): string {
  const username = os.userInfo().username;
  if (!username) {
    return msg;
  }
  return msg.replace(new RegExp(escapeRegExp(username), 'g'), '***');
}

/**
 * Escapes special regex characters in a string.
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
    const destination = wrapWithMasking(
      pino.destination({
        dest: logFilePath,
        append: true,
        sync: false, // Use async writing for better performance
      }),
    );

    return pino({
      level: logLevel,
      // Local app — no need for `pid` or `hostname`; `time` alone identifies
      // the moment of emission.
      base: null,
    }, destination);
  } else {
    // Console logging (default). Use an explicit stdout destination so we
    // can apply the same masking wrapper as the file branch — keeps
    // console output consistent with what's persisted to disk.
    const destination = wrapWithMasking(pino.destination(1));
    return pino({
      level: logLevel,
      base: null,
    }, destination);
  }
}


/**
 * Logs incoming HTTP request.
 * In debug mode, includes the request body; otherwise only logs method and URL.
 */
export function logHttpReqIn(c: Context, body?: unknown) {
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
export function logHttpRespOut(c: Context, body: unknown, statusCode: number = 200) {
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

/**
 * Logs outgoing HTTP request to external API.
 * In debug mode, includes the request body; otherwise only logs method and URL.
 */
export function logHttpReqOut(url: string, method: string = 'GET', body?: unknown) {
  const logData: Record<string, unknown> = {
    method,
    url,
    target: 'external',
  };

  if (logger.isLevelEnabled('debug') && body !== undefined) {
    logData.body = body;
  }

  logger.info(logData, 'HTTP request sent to external API');
}

/**
 * Logs incoming HTTP response from external API.
 * In debug mode, includes the response body; otherwise only logs method, URL, and status code.
 * Automatically determines error state by checking status code >= 400.
 */
export function logHttpRespIn(url: string, statusCode: number, body?: unknown) {
  const logData: Record<string, unknown> = {
    url,
    statusCode,
    target: 'external',
  };

  console.log(`logger.isLevelEnabled('debug'): ${logger.isLevelEnabled('debug')}`)
  console.log(`body: ${JSON.stringify(body, null, 2)}`)

  if (logger.isLevelEnabled('debug') && body !== undefined) {
    logData.body = body;
  }

  if (statusCode >= 400) {
    logger.error(logData, 'HTTP response received from external API (error)');
  } else {
    logger.info(logData, 'HTTP response received from external API');
  }
}

await initSensitiveStrings();

// Create and export the logger instance
export const logger = await createLogger();
logger.debug(`pino: log level is ${logger.level}`)

/**
 * Logger dedicated to frontend-sourced log entries. Streams to a rotating
 * browser.log file under the application log directory. Independent of
 * LOG_TARGET so the frontend trail is captured even when the backend is in
 * console-only mode.
 */
export const frontendLogger = pino(
  { level: process.env.LOG_LEVEL ?? "info", base: null },
  // pino accepts any Node Writable as a destination; rotating-file-stream
  // implements that interface. The masking wrapper makes sure sensitive
  // strings never reach browser.log on disk.
  wrapWithMasking(
    createFrontendLogStream() as unknown as NodeJS.WritableStream,
  ) as unknown as pino.DestinationStream,
);

// Export a default as well for convenience
export default logger;

/**
 * Log with trace ID context
 * @param level Log level ('info', 'warn', 'error', 'debug')
 * @param traceId Trace ID for request correlation
 * @param message Log message
 * @param data Additional data to log
 */
export function logWithTrace(
  level: 'info' | 'warn' | 'error' | 'debug',
  traceId: number,
  message: string,
  data?: Record<string, unknown>
) {
  logger[level]({ traceId, ...data }, message);
}

/**
 * Create a child logger with trace ID bound
 * @param traceId Trace ID to bind to the logger
 * @returns A child logger instance with trace ID in all log entries
 */
export function createTraceLogger(traceId: number) {
  return logger.child({ traceId });
}
