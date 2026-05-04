import { generateText } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { Hono } from 'hono';
import { logger } from '../../lib/logger';

interface CheckConnectionRequest {
  model: string;
  apiKey: string;
  baseURL: string;
}

export function handleAICheck(app: Hono) {
  app.post('/api/ai/check', async (c) => {
    let body: CheckConnectionRequest;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    if (!body.model) {
      return c.json({ error: 'model is required' }, 400);
    }
    if (!body.apiKey) {
      return c.json({ error: 'apiKey is required' }, 400);
    }
    if (!body.baseURL) {
      return c.json({ error: 'baseURL is required' }, 400);
    }

    const { model, apiKey, baseURL } = body;

    const provider = createOpenAICompatible({
      name: 'ai-check',
      baseURL,
      apiKey,
    });

    try {
      await generateText({
        model: provider.chatModel(model),
        prompt: 'hello',
      });

      return c.json({ name: 'ai-check', model, status: 'ok' });
    } catch (error) {
      const maskedApiKey = apiKey.length > 6
        ? '*'.repeat(apiKey.length - 6) + apiKey.slice(-6)
        : '***';
      logger.error({
        baseURL,
        model,
        apiKey: maskedApiKey,
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
        } : error
      }, 'AI check connection error');

      return c.json({ name: 'ai-check', model, status: 'error' }, 200);
    }
  });
}
