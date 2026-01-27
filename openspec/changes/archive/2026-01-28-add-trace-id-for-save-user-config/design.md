## Context

**Current State:**
The user configuration save operation spans multiple layers:
- UI: `saveUserConfig()` in `config-provider.tsx` calls `writeFile()` API
- API Layer: `writeFile.ts` makes HTTP POST to `/api/writeFile`
- Backend: `handleWriteFile()` in `WriteFile.ts` calls `doWriteFile()`
- File System: `Bun.write()` performs the actual write

**Current Logging:**
- UI: Basic `console.log` without correlation
- API Layer: No logging
- Backend: `logHttpIn/logHttpOut` via pino, but no request-scoped correlation
- Business Logic: No structured logging in `doWriteFile()`

When errors occur, there's no way to trace a single operation through all these layers.

**Constraints:**
- Must maintain backward compatibility (existing clients without trace ID support)
- Must work in both development (Electron) and production (web server) environments
- Minimal performance overhead
- No new external dependencies

## Goals / Non-Goals

**Goals:**
- Enable end-to-end request tracing from UI to file system
- Provide trace-aware logging at all layers with consistent `[traceId]` format
- Use HTTP header for trace ID transport (standard practice, no API contract changes)
- Maintain full backward compatibility (trace ID is optional)

**Non-Goals:**
- Distributed tracing across multiple services (single-process architecture)
- Automatic trace ID injection for all API endpoints (scope: only `saveUserConfig` flow)
- Trace ID storage or persistence (ephemeral per-request only)
- Performance metrics or timing analysis (logging only)

## Decisions

### 1. Trace ID Generation: `{event_name}-{counter}` Format

**Decision:** Generate trace ID at the UI layer using format `{event_name}-{counter}` where:
- `event_name` is the source file or component name (e.g., `AppV2`, `saveUserConfig`)
- `counter` is an integer from `nextTraceId()` utility that persists in localStorage

**Rationale:**
- Uses existing `nextTraceId()` utility for counter generation (integer-based)
- Event name prefix provides semantic context for debugging
- Format matches documented standard in `docs/trace-id.md`
- LocalStorage persistence survives page reloads
- Runtime fallback if localStorage unavailable
- Sufficient uniqueness for request correlation
- Generates at request origin for full end-to-end visibility

**Example Trace IDs:**
- `AiSettings-1241` - Generated from AiSettings component when saving
- `GeneralSettings-1322` - Generated from GeneralSettings component when saving
- `MediaFolderListItem-1456` - Generated from MediaFolderListItem when deleting/rename folder
- `AppV2-updateMediaMetadata-1567` - Generated from AppV2 when updating media metadata
- `saveUserConfig-1689` - Generated from saveUserConfig function (if called directly)

**Alternatives Considered:**
- **Backend generation**: Rejected - would lose UI-side correlation
- **Simple integer only**: Rejected - less informative, harder to trace back to source
- **UUID generation**: Rejected - unnecessary complexity, counter is sufficient
- **Timestamp-based**: Rejected - collision risk in parallel requests

### 2. Transport via HTTP Header Only

**Decision:** Pass trace ID only via HTTP header (`X-Trace-Id`), not in request body. The header contains just the numeric counter (e.g., "1241"), not the full `{event_name}-{counter}` string.

**Rationale:**
- **Standard practice**: HTTP headers are the conventional way to pass trace IDs (similar to W3C Trace Context)
- **No API contract changes**: Request body remains unchanged, maintaining backward compatibility
- **Simpler implementation**: Numeric value is easier to parse and process in backend logging
- **Always available**: Headers survive even if body parsing fails or is malformed
- **Middleware-friendly**: Easy to extract in middleware/logging layers
- **Separation of concerns**: Full trace ID with event name is used in UI logs, numeric part for backend correlation

**Implementation:**
- UI: Extract numeric counter from `{event_name}-{counter}` format using `parseInt(traceId.split('-')[1], 10)`
- Header: Send just the number as string (e.g., "1241")
- Backend: Parse header to integer and use in pino logging

**Alternatives Considered:**
- **Request body**: Rejected - requires API contract changes (`WriteFileRequestBody` modification), more complex
- **Full string in header**: Rejected - numeric is simpler for backend processing, event name is redundant after UI layer
- **Dual transport (body + header)**: Rejected - unnecessary complexity, header alone is sufficient
- **Query parameter**: Rejected - inappropriate for POST requests, exposes in logs

### 3. Logging Format: `[traceId]` Prefix

**Decision:** Use `[traceId]` prefix format for console logs (UI) and pino structured field (backend)

**Rationale:**
- **UI (console)**: `[42] saveUserConfig: Starting` - grep-friendly, compact
- **Backend (pino)**: `logger.info({ traceId }, "message")` - structured logging
- **Consistent**: Same ID across all layers enables grep/log aggregation correlation

**Alternatives Considered:**
- **JSON-only logs**: Rejected - harder to read in console during development
- **Separate logging library**: Rejected - pino already used, console.log sufficient for UI

### 4. Backward Compatibility: Optional Trace ID

**Decision:** Trace ID is optional - all layers handle missing trace ID gracefully

**Rationale:**
- Zero breaking changes to existing API contracts (request body unchanged)
- Graceful degradation if trace ID missing (logs use default value `0`)
- No migration required for existing code
- HTTP headers are naturally optional - no schema changes needed

**Implementation:**
- Backend extracts from header: `const traceId = parseInt(c.req.header('X-Trace-Id') || '0', 10)`
- Missing header defaults to `0`
- No type changes to request body interfaces

## Risks / Trade-offs

### Risk 1: Performance Impact from Excessive Logging

**Risk**: Adding logs at every layer could slow down config save operations

**Mitigation:**
- Use existing pino infrastructure (async, low overhead)
- Console logs only in development (already the case)
- Production log level controlled by `LOG_LEVEL` environment variable

### Risk 2: LocalStorage Unavailable

**Risk**: `nextTraceId()` relies on localStorage, which may be unavailable in private browsing mode or if storage quota exceeded

**Mitigation:**
- `nextTraceId()` already has runtime fallback counter if localStorage fails
- Trace ID uniqueness is still maintained within the page session
- Integer-based IDs are sufficient even without cross-session persistence

### Risk 3: Inconsistent Logging Formats

**Risk**: Different developers might use different log formats, making correlation harder

**Mitigation:**
- Document standard format in design doc
- Provide helper functions in `logger.ts` for common patterns
- Example: `logWithTrace('info', traceId, 'message', data)`

### Trade-off: Manual Trace ID Propagation

**Trade-off**: We're not using automatic context propagation (like OpenTelemetry)

**Rationale for Manual Approach:**
- Simpler implementation for single-process architecture
- No additional dependency overhead
- Sufficient for current debugging needs
- Can upgrade to OpenTelemetry later if needed (trace ID field already present)

## Migration Plan

**Deployment Steps:**
1. Deploy backend changes first (backward compatible, ignores missing trace ID)
2. Deploy UI changes (adds trace ID generation)
3. Verify logs show trace ID in both frontend console and backend logs
4. Monitor for any issues

**Rollback Strategy:**
- Fully backward compatible - can revert frontend changes without breaking backend
- Backend changes are additive (optional field) - safe to keep or revert
- No database migrations or external state changes

## Open Questions

**Q1: Should we add trace ID to other file operations (`readFile`, `listFiles`, etc.)?**

**A:** Out of scope for this change. Current scope is only `saveUserConfig` flow. Future changes can extend pattern to other operations if needed.

**Q2: Should trace ID be stored in the config file itself?**

**A:** No. Trace ID is for operational tracing, not data persistence. Config file content should remain unchanged.

**Q3: Should we add timing information to trace logs?**

**A:** Not in this change. Current focus is correlation only. Performance tracking can be added later if needed (would require timestamp capture at each layer).
