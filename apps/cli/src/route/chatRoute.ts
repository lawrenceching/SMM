import type { Hono } from 'hono';
import { doChat, type ChatConfig } from '@smm/core-routes';
import { logger } from '../../lib/logger';

/**
 * Register a Hono shell for `POST /api/chat` that delegates to
 * {@link doChat} in `@smm/core-routes`. The Hono shell is kept
 * intentionally thin — the chat pipeline (request validation,
 * agent tool set, streaming response) is now shared between cli
 * (Bun) and ohos (Electron Main / Node). Only the runtime-specific
 * bits (provider factory, user-config reader, Socket.IO
 * acknowledge) live in the host.
 */
export function handleChatRequest(app: Hono, chatConfig: ChatConfig) {
  app.post('/api/chat', async (c) => {
    try {
      const response = await doChat(chatConfig, c.req.raw);
      return response;
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
        } : error },
        'Chat route error:',
      );
      return c.json(
        {
          error: 'Failed to process chat request',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        500,
      );
    }
  });
}
