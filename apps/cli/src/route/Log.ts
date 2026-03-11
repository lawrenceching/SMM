import type { Hono } from 'hono';
import { z } from 'zod/v3';
import { logger } from '../../lib/logger';

// Rate limiter: 10 logs per second
const RATE_LIMIT_PER_SECOND = 10;

// Simple in-memory rate limiter
class RateLimiter {
  private requestCounts: Map<string, { count: number; resetTime: number }> = new Map();

  /**
   * Check if the request is allowed under rate limit
   * @param key - identifier for the rate limit bucket (e.g., client IP or 'global')
   * @returns true if allowed, false if rate limited
   */
  isAllowed(key: string = 'global'): boolean {
    const now = Date.now();
    const windowStart = Math.floor(now / 1000) * 1000; // Current second start
    const nextResetTime = windowStart + 1000; // Next second

    const record = this.requestCounts.get(key);

    if (!record || now >= record.resetTime) {
      // New window or expired window
      this.requestCounts.set(key, {
        count: 1,
        resetTime: nextResetTime,
      });
      return true;
    }

    // Within current window
    if (record.count < RATE_LIMIT_PER_SECOND) {
      record.count++;
      return true;
    }

    // Rate limit exceeded
    return false;
  }

  /**
   * Clean up expired entries to prevent memory leak
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.requestCounts.entries()) {
      if (now >= record.resetTime) {
        this.requestCounts.delete(key);
      }
    }
  }
}

// Global rate limiter instance
const rateLimiter = new RateLimiter();

// Periodic cleanup every 60 seconds
setInterval(() => {
  rateLimiter.cleanup();
}, 60000);

// Log level type
const LogLevel = z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']);

// Schema for log request body
const logRequestSchema = z.object({
  level: LogLevel.default('info'),
  message: z.string().min(1, 'Message is required'),
  context: z.record(z.unknown()).optional(),
});

/**
 * Handle log requests from frontend
 * POST /api/log
 *
 * Rate limited to 10 logs per second.
 * Excess logs are silently dropped with 204 No Content response.
 */
export function handleLog(app: Hono): void {
  app.post('/api/log', async (c) => {
    // Check rate limit first
    if (!rateLimiter.isAllowed()) {
      // Rate limit exceeded - silently drop the log
      return new Response(null, { status: 204 });
    }

    try {
      const rawBody = await c.req.json();

      // Validate request body
      const validationResult = logRequestSchema.safeParse(rawBody);

      if (!validationResult.success) {
        // Validation failed - return 400 with error details
        return c.json(
          {
            error: 'Validation failed',
            details: validationResult.error.issues.map((err) => ({
              path: err.path.join('.'),
              message: err.message,
            })),
          },
          400
        );
      }

      const { level, message, context } = validationResult.data;

      // Add frontend source identifier to context
      const logContext = {
        ...(context || {}),
        source: 'frontend'
      };

      // Log through Pino based on level
      switch (level) {
        case 'trace':
          logger.trace(logContext, message);
          break;
        case 'debug':
          logger.debug(logContext, message);
          break;
        case 'info':
          logger.info(logContext, message);
          break;
        case 'warn':
          logger.warn(logContext, message);
          break;
        case 'error':
          logger.error(logContext, message);
          break;
        case 'fatal':
          logger.fatal(logContext, message);
          break;
      }

      // Return 204 No Content on success
      return new Response(null, { status: 204 });
    } catch (error) {
      // JSON parsing error or other unexpected errors
      logger.error({ error }, 'Failed to process log request');
      return c.json(
        {
          error: 'Failed to process log request',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        400
      );
    }
  });
}
