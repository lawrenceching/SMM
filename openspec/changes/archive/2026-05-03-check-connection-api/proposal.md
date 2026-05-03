## Why

Users configure AI providers (DeepSeek, OpenAI, OpenRouter, GLM, Other) in app settings, but there is no way to verify the connection works before entering a chat. A failing connection only surfaces when the chat request errors out, causing confusion.

## What Changes

- New HTTP API `POST /api/ai/check` that tests connectivity to the specified AI provider
- Accepts `{ ai, model, apiKey }` in the JSON request body
- Sends a "hello" message to the AI model using the Vercel AI SDK's `generateText`
- Returns `{ ai, model, status }` where status is `"ok"` on success or `"error"` with an error message on failure

## Capabilities

### New Capabilities
- `ai-check-connection`: API endpoint that validates AI provider connectivity using the Vercel AI SDK

### Modified Capabilities
<!-- No existing specs require changes -->

## Impact

- **New file**: `apps/cli/src/route/AICheck.ts` — route handler registering `/api/ai/check`
- **Modified**: `apps/cli/server.ts` — register the new route in `setupRoutes()`
- **Dependencies**: Uses `createAIProvider` from `apps/cli/lib/ai-provider.ts` and `generateText` from `ai` (Vercel AI SDK)
