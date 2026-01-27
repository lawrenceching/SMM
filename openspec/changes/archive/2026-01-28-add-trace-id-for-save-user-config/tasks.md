## 1. UI Layer - Config Provider

- [x] 1.1 Import `nextTraceId` from `@/lib/utils` in `ui/src/providers/config-provider.tsx`
- [x] 1.2 Update `saveUserConfig` method to accept trace ID as parameter (full `{event_name}-{counter}` string)
- [x] 1.3 Add trace-aware logging with `[traceId]` prefix format in `saveUserConfig` method (e.g., `[AiSettings-1241] saveUserConfig: Starting`)
- [x] 1.4 Extract numeric counter from full trace ID string using `parseInt(traceId.split('-')[1], 10)`
- [x] 1.5 Pass numeric counter to `writeFile` API function call
- [x] 1.6 Update `addMediaFolderInUserConfig` method to propagate trace ID to `saveUserConfig`

## 2. UI Layer - API Client

- [x] 2.1 Update `writeFile` function signature in `ui/src/api/writeFile.ts` to accept optional `traceId: number` parameter (numeric counter only)
- [x] 2.2 Add `X-Trace-Id` HTTP header to fetch request with numeric counter as string
- [x] 2.3 Add trace-aware logging with `[traceId]` prefix for request and response (using numeric counter)
- [x] 2.4 Add error logging with trace ID context when request fails

## 3. Backend Layer - Request Handler

- [x] 3.1 Update `handleWriteFile` function in `cli/src/route/WriteFile.ts` to extract trace ID from `X-Trace-Id` header
- [x] 3.2 Parse header value to integer with fallback: `parseInt(c.req.header('X-Trace-Id') || '0', 10)`
- [x] 3.3 Pass trace ID to `doWriteFile` function for logging context

## 4. Backend Layer - Business Logic

- [x] 4.1 Update `doWriteFile` function signature to accept optional `traceId: number` parameter
- [x] 4.2 Add comprehensive logging with trace ID throughout `doWriteFile`:
  - [x] 4.2.1 Log operation start with trace ID (number type in pino)
  - [x] 4.2.2 Log validation results with trace ID
  - [x] 4.2.3 Log path validation with trace ID
  - [x] 4.2.4 Log file write operations with trace ID
  - [x] 4.2.5 Log errors with trace ID context

## 5. Backend Layer - Logger Enhancements (Optional)

- [x] 5.1 Add `logWithTrace` helper function in `cli/lib/logger.ts` for logging with trace ID context
- [x] 5.2 Add `createTraceLogger` helper function for child logger with bound trace ID
- [x] 5.3 Update existing log calls to use trace-aware helpers where appropriate

## 6. Testing and Verification

- [x] 6.1 Manual test: Trigger config save from UI (e.g., AI Settings, General Settings) and verify trace ID appears in console logs as `[AiSettings-1241]`, `[GeneralSettings-1242]`, etc.
- [x] 6.2 Manual test: Verify backend logs include trace ID counter as number in pino structured format (e.g., `{"traceId": 1241, ...}`)
- [x] 6.3 Manual test: Search logs by trace ID to confirm end-to-end correlation (e.g., grep for `[AiSettings-1241]` in UI logs, pino query for `traceId:1241` in backend logs)
- [x] 6.4 Manual test: Verify backward compatibility - test with old client without `X-Trace-Id` header (should default to 0)
- [x] 6.5 Manual test: Verify concurrent requests generate unique incrementing counters
- [x] 6.6 Manual test: Verify localStorage persistence - trace ID counter increments across page reloads
- [x] 6.7 Manual test: Verify request body is unchanged (no `traceId` field in body, only in header)

**Note**: See `TESTING.md` for detailed manual testing steps and expected results.

## 7. Documentation

- [x] 7.1 Add trace ID format documentation to developer docs (format: `{event_name}-{counter}`, uses `nextTraceId()`, transported via `X-Trace-Id` header as numeric counter only)
  - Created `docs/trace-id-format.md` with comprehensive guide
  - Includes format specification, implementation details, and debugging workflow
  - Contains examples and troubleshooting guide
- [x] 7.2 Update API documentation for `/api/writeFile` to describe `X-Trace-Id` header (optional, string representation of numeric counter extracted from full trace ID)
  - Updated `cli/docs/FileOperationAPI.md` with X-Trace-Id header documentation
  - Added example request and response
  - Documented backward compatibility behavior
- [x] 7.3 Add troubleshooting guide for using trace IDs in debugging (grep patterns, pino queries)
  - Included in `docs/trace-id-format.md`
  - Covers common issues and resolution steps
  - Provides debugging workflow and best practices
