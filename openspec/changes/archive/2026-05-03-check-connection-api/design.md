## Context

The CLI backend manages AI provider configuration via `UserConfig.ai` (one `OpenAICompatibleConfig` per provider: DeepSeek, OpenAI, OpenRouter, GLM, Other). The existing chat route (`POST /api/chat` in `ChatTask.ts`) uses `createAIProvider(userConfig)` from `apps/cli/lib/ai-provider.ts` to build an OpenAI-compatible provider and streams a chat response. However, there is no way to verify a provider connection before starting a chat session.

The request body carries `ai` (the provider type), `model`, and `apiKey`. The `baseURL` is resolved from the persisted `UserConfig.ai.<provider>.baseURL` for that AI type.

## Goals / Non-Goals

**Goals:**
- Provide a synchronous `POST /api/ai/check` endpoint that tests AI provider connectivity
- Accept `{ ai, model, apiKey }` and return `{ ai, model, status }`
- Use Vercel AI SDK's `generateText` to send a "hello" message and verify a response
- Follow the existing route handler pattern (separate file, export `handleXxx(app: Hono)`, register in `server.ts`)

**Non-Goals:**
- Streaming responses (the check is a simple request/response)
- Modifying user config or persisting anything
- MCP tool integration (just an HTTP endpoint)
- Testing provider-specific capabilities beyond basic connectivity

## Decisions

1. **Use `generateText` instead of `streamText`** — The check is a simple round-trip test, not a streaming chat. `generateText` is synchronous and returns a complete response, making error handling simpler.

2. **Derive `baseURL` from user config, not request body** — The request body carries `ai`, `model`, `apiKey` only. The `baseURL` is read from `UserConfig.ai.<provider>.baseURL` to avoid requiring the client to know the URL. If no saved config exists for that AI type, the endpoint returns an appropriate error.

3. **New file `apps/cli/src/route/AICheck.ts`** — Follow the existing pattern: each route handler gets its own file. The existing `ai.ts` handles `matchMediaFilesToEpisode`; this is a separate concern.

4. **Send literally "hello" as the user message** — A minimal prompt that any model can respond to. No schema/structured output needed.

5. **Return `status: "ok"` on success, `status: "error"` with message on failure** — Simple, flat response shape consistent with REST conventions.

## Risks / Trade-offs

- **`generateText` may take several seconds** depending on the model/provider. The caller should set a reasonable HTTP timeout. → Mitigation: The caller can set a timeout on the fetch request.
- **API key is sent in plaintext over HTTP request body** — Same as existing chat route. The local CLI runs on localhost, so this is acceptable for a desktop app. → Mitigation: Document that this is localhost-only communication.
- **User config may not have a `baseURL` for the requested AI type** — The endpoint returns a 400 with a descriptive error message.
