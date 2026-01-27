## Why

When saving user configuration fails or succeeds, there is currently no way to correlate logs across the frontend console, HTTP request/response layer, and backend business logic. This makes debugging difficult when issues occur during config save operations. Implementing trace ID support will enable end-to-end request tracing for better observability and faster issue diagnosis.

Trace IDs follow the `{event_name}-{counter}` format as documented in `docs/trace-id.md`, where:
- `event_name` identifies the source component or function (e.g., `AiSettings`, `GeneralSettings`, `MediaFolderListItem`)
- `counter` is an integer from `nextTraceId()` utility that persists in localStorage

## What Changes

- **Generate trace ID** at the entry point with format `{event_name}-{counter}` using existing `nextTraceId()` utility for counter
- **Pass trace ID** through the entire call chain: UI → API layer → HTTP request → backend handler → file operations
- **Add trace-aware logging** with `[<traceId>]` prefix format across all layers
- **Include trace ID in HTTP header** (`X-Trace-Id`) with just the numeric counter for request correlation
- **Add comprehensive logging** in backend `doWriteFile` function with trace ID context

## Capabilities

### New Capabilities
- `request-tracing`: End-to-end request tracking with unique trace identifiers that propagate through all system layers (UI, API, backend) for improved observability and debugging

### Modified Capabilities
- None (this is an implementation enhancement that doesn't change existing behavioral requirements)

## Impact

**Affected Code:**
- `ui/src/providers/config-provider.tsx` - Import and use `nextTraceId()` in `saveUserConfig`, add trace-aware logging
- `ui/src/api/writeFile.ts` - Accept optional `traceId` parameter (number), include in HTTP header
- `cli/src/route/WriteFile.ts` - Extract trace ID from `X-Trace-Id` header, add comprehensive logging with trace context
- `cli/lib/logger.ts` - Optionally add trace ID helper functions

**Affected APIs:**
- `POST /api/writeFile` - Will accept optional `X-Trace-Id` header (number as string)

**Dependencies:**
- No new external dependencies (reuses existing `nextTraceId()` utility from `@/lib/utils`)

**Backward Compatibility:**
- Fully backward compatible - `traceId` is optional in all layers
