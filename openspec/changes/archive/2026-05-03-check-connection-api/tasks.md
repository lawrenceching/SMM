## 1. Create route handler

- [x] 1.1 Create `apps/cli/src/route/AICheck.ts` with `handleAICheck(app: Hono)` that registers `POST /api/ai/check`
- [x] 1.2 Implement request body parsing for `{ ai, model, apiKey }` with validation for missing fields
- [x] 1.3 Resolve `baseURL` from `UserConfig.ai.<provider>.baseURL` for the given AI type, returning 400 if not found
- [x] 1.4 Create an OpenAI-compatible provider using `createOpenAICompatible` with the resolved baseURL and request-provided apiKey
- [x] 1.5 Call `generateText` with model and a "hello" message, catching any errors
- [x] 1.6 Return `{ ai, model, status: "ok" }` on success or `{ ai, model, status: "error" }` with error details on failure

## 2. Register route in server

- [x] 2.1 Import and call `handleAICheck` in `apps/cli/server.ts` `setupRoutes()` method

## 3. Verify

- [x] 3.1 Run `pnpm typecheck` and ensure no type errors (pre-existing CLI errors only, none from new code)
- [x] 3.2 Run `pnpm test` and ensure all existing tests pass
