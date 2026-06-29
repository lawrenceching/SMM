# Frontend Console Log Streaming Design

Date: 2026-06-29
Status: Implemented (commits dc29d690..72e0c53a, 2026-06-29)

## Problem

When users report bugs, the SMM frontend has no persistent log trail. The CLI backend writes its own logs to disk, but the UI's `console.*` calls — 470 occurrences across 119 files — exist only in the browser's devtools and disappear when the tab closes. Bug reports arrive with no way to see what the UI was doing when the issue occurred.

## Goal

Capture every frontend `console.log / info / warn / error / debug` call, stream it to the CLI backend, and persist it in a rotated log file under the existing log directory so users can locate and upload it manually when filing bugs.

Out of scope: React ErrorBoundary capture, network/fetch failure capture, source-map deobfuscation, sampling, in-UI log viewer, "download logs" button.

## Architecture

```
Browser (apps/ui)                                Backend (apps/cli)
─────────────────                                ────────────────
main.tsx bootstrap
   │
   ▼
installConsoleInterceptor() — wraps 5 methods
   │
   ▼
console.log/info/warn/error/debug
   │
   ▼
FrontendLogBuffer (ring, 1000)
   │
   ▼ flush: every 2s OR ≥50 entries OR pagehide
FrontendLogFlusher
   │
   ▼
navigator.sendBeacon(POST /api/log, JSON batch)
fallback: fetch({ keepalive: true })
                                                 POST /api/log
                                                    │
                                                    ▼
                                                 pino child logger
                                                 (source: frontend)
                                                    │
                                                    ▼
                                                 rotating-file-stream
                                                 (10MB × 5 files)
                                                 → browser.log
```

## Frontend Modules (new)

### `apps/ui/src/types/frontendLog.ts`

Shared wire types.

```ts
export type FrontendLogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug'

export interface SerializedArg {
  kind: 'string' | 'number' | 'boolean' | 'null' | 'undef' | 'symbol' | 'object' | 'error' | 'circular' | 'fn'
  value: string  // JSON-safe string; Error → "{name}: {message}\n{stack}"
}

export interface FrontendLogEntry {
  level: FrontendLogLevel
  args: SerializedArg[]
  ts: number        // Date.now() at the call site
  url: string       // window.location.href at the call site
  sessionId: string // sessionStorage-persisted UUID; shared across reloads within the tab lifetime
}

export interface FrontendLogBatch {
  entries: FrontendLogEntry[]
  appVersion: string
}
```

### `apps/ui/src/lib/frontendLogBuffer.ts`

In-memory ring buffer (FIFO, capacity 1000).

- `push(entry: FrontendLogEntry): void` — append; if at capacity, drop oldest.
- `drain(): FrontendLogEntry[]` — return and clear all entries.
- `size(): number`

Serialization rules for each `console` arg:
- `string` / `number` / `boolean` → `kind: 'string'|'number'|'boolean'`, `value: String(x)`
- `null` / `undefined` → `kind: 'null'|'undef'`, `value: ''`
- `Error` → `kind: 'error'`, `value: name + ': ' + message + '\n' + stack`
- `function` → `kind: 'fn'`, `value: Function.prototype.toString.call(fn).slice(0, 200)`
- `symbol` → `kind: 'symbol'`, `value: s.toString()`
- Object / array → try `JSON.stringify`; on `TypeError` (circular) → `kind: 'circular'`, `value: '[Circular]'`
- BigInt → `kind: 'string'`, `value: n.toString() + 'n'`

### `apps/ui/src/lib/consoleInterceptor.ts`

One-shot installer called from `bootstrap()` in `main.tsx`, before `createRoot`.

- Guard: if already installed (idempotent across HMR re-imports), return.
- Save originals: `originalLog = console.log`, etc.
- Replace each method with a wrapper that:
  1. Calls `originalX(...args)` so devtools still shows the log.
  2. Builds a `FrontendLogEntry` with `level`, serialized `args`, `ts = Date.now()`, `url = location.href`, `sessionId = getOrCreateSessionId()`.
  3. Calls `buffer.push(entry)`.
- `getOrCreateSessionId()` reads `sessionStorage.getItem('smm.frontendLog.sessionId')`; if missing, generates `crypto.randomUUID()` and stores it.

### `apps/ui/src/lib/frontendLogFlusher.ts`

Periodic + threshold + unload flusher.

Configuration (constants):
- `FLUSH_INTERVAL_MS = 2_000`
- `FLUSH_THRESHOLD = 50`
- `ENDPOINT = '/api/log'` (relative; routed through existing `apiFetch` base URL)

Lifecycle:
- `start()` — installs `setInterval` flush, registers `pagehide` listener, registers `visibilitychange` (only flushes on `document.visibilityState === 'hidden'`).
- `stop()` — clears interval, removes listeners.

Flush logic (one shared path):
1. `const entries = buffer.drain()`; if empty, return.
2. Wrap into `FrontendLogBatch` with `appVersion = import.meta.env.VITE_APP_VERSION ?? 'unknown'`.
3. Try `navigator.sendBeacon(ENDPOINT, new Blob([JSON.stringify(batch)], { type: 'application/json' }))`. If returns `true`, done.
4. Fallback: `fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(batch), keepalive: true })`. Errors are swallowed.
5. Never throw to the caller. Never log to console from inside the flusher (would recurse).

Trigger conditions:
- Interval: every `FLUSH_INTERVAL_MS` if `buffer.size() > 0`.
- Threshold: `buffer.push()` calls a check; if size crosses `FLUSH_THRESHOLD`, flush immediately.
- Unload: `pagehide` event (covers mobile + desktop, including bfcache restore).

### `apps/ui/src/main.tsx` integration

Single call inserted before `createRoot`:

```ts
import { installConsoleInterceptor } from '@/lib/consoleInterceptor'
import { startFrontendLogFlusher } from '@/lib/frontendLogFlusher'

installConsoleInterceptor()
startFrontendLogFlusher()
```

Both calls are synchronous and side-effect-only; no await needed.

## Backend Modules

### `apps/cli/src/utils/FrontendLogFile.ts` (new)

Wraps `rotating-file-stream` to expose a pino-compatible destination.

```ts
import { RotatingFileStream } from 'rotating-file-stream'
import { getLogDir } from '@/utils/config'

export function createFrontendLogStream(): RotatingFileStream {
  const logDir = getLogDir()
  return createStream('browser.log', {
    path: logDir,
    size: process.env.FRONTEND_LOG_ROTATE_SIZE ?? '10MB',
    maxFiles: Number(process.env.FRONTEND_LOG_ROTATE_KEEP ?? 5),
    compress: 'gzip',
  })
}
```

Default rotate: 10MB per file × 5 files (current + 4 rotated, gzipped). Oldest deleted on overflow.

### `apps/cli/lib/logger.ts` (extend)

Add a frontend-targeted logger. Keep existing `logger` export (and `default` export) for backward compatibility — they continue to point at `smm.log`.

```ts
export const frontendLogger = pino(
  { level: process.env.LOG_LEVEL ?? 'info' },
  createFrontendLogStream()
)
```

`createLogger()` is extended so that when `LOG_TARGET === 'file'`, the main `logger` keeps writing to `smm.log`; the new `frontendLogger` is created unconditionally because it has its own file target.

### `apps/cli/src/route/Log.ts` (extend)

Three accepted body shapes:

```ts
// Single entry (current behaviour)
{ level: 'trace'|'debug'|'info'|'warn'|'error'|'fatal', message: string, context?: Record<string, unknown> }

// Array of entries (frontend flush)
[SingleEntry, SingleEntry, ...]

// Batched with app version (preferred)
{ entries: SingleEntry[], appVersion: string }
```

Discriminator (in this order, in the route handler):
1. If `body && typeof body === 'object' && Array.isArray(body.entries)` → batch form.
2. Else if `Array.isArray(body)` → array form (treat each element as a single entry).
3. Else → single entry form.

This precedence avoids misclassifying a single-entry object that happens to have an `entries` array inside `context`.

Validation:
- Each `level` must be `LogLevel` enum value (keep existing zod schema).
- Each `message` field required.
- Array entries are checked with `z.array(...)`.

Limits:
- `MAX_ENTRY_BYTES = Number(process.env.FRONTEND_LOG_MAX_BYTES ?? 4096)` — single message + serialized context; if exceeded, truncate `message` and set `context.truncated = true`. If still over after truncation, drop the entry with a one-time warning log to the backend logger.
- `MAX_BATCH_ENTRIES = Number(process.env.FRONTEND_LOG_BATCH_MAX ?? 200)` — return `413 Payload Too Large` if exceeded.

Rate limiting (extend existing):
- Existing `RateLimiter` (10/sec) is preserved. Per batch, charge `max(1, ceil(entries / 50))` credits. On exhaustion, return `429 Too Many Requests`.
- The `RateLimiter` keys by `clientIp ?? 'global'`.

Per-entry augmentation (server-side):
- `serverReceivedAt: new Date().toISOString()` — server clock at receipt.
- `clientIp: req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown'` — already on Hono context.
- `appVersion` from batch (if present) bubbled to every entry as `appVersion` context field.

Writing:
- Map the entry's `level` to a pino method via `LEVEL_MAP`:
  - `'log'` (frontend only) → `frontendLogger.info`
  - `'info' | 'debug' | 'warn' | 'error'` → same-named pino method
  - `'trace' | 'fatal'` (single-entry form only) → `frontendLogger.trace` / `frontendLogger.fatal`
- Call `frontendLogger[method](logContext, '[frontend] ' + message)`. The `'[frontend] '` prefix lets operators `grep '^\\[frontend\\]' smm.log` if both files are ever joined, and is consistent in `browser.log` alone.

Response codes:
- `204 No Content` — success.
- `400 Bad Request` — zod validation failure, returns `{ error, details }`.
- `413 Payload Too Large` — batch over `MAX_BATCH_ENTRIES`.
- `429 Too Many Requests` — rate limit.
- Existing 204 behaviour for already-silently-dropped over-rate requests is replaced by explicit 429 so the flusher can react if it ever wants to (it currently still ignores the response).

### `apps/cli/package.json`

Add dependency:

```json
"rotating-file-stream": "^3.0.0"
```

## Data Flow Example

Frontend user clicks a button that calls `console.log('opening', folderId)`:

1. Wrapper records `{ level: 'log', args: [{kind:'string',value:'opening'}, {kind:'string',value:'folderId'}], ts: 1719660000000, url: 'http://localhost:5173/', sessionId: 'f3a...' }`.
2. Entry goes into buffer. If buffer now ≥ 50, immediate flush.
3. Otherwise, on next 2s tick, buffer is drained and `sendBeacon('/api/log', blob)` is called with `{ entries: [...], appVersion: '1.4.0' }`.
4. Backend route unpacks batch, validates, charges `ceil(50/50) = 1` rate-limit credit, augments each entry with `serverReceivedAt` and `clientIp`, then writes via `frontendLogger.info({ ..., source: 'frontend', sessionId, ts: 1719660000000, appVersion: '1.4.0' }, '[frontend] opening folderId')` to the rotating stream.
5. After rotation (e.g. when `browser.log` reaches 10MB), it's renamed `browser.log.1.gz` and a fresh `browser.log` starts. Up to 4 old files retained.

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| Backend rejects (4xx/5xx) | Flusher swallows. No console call from flusher (would recurse). |
| `sendBeacon` returns `false` | Fall through to fetch keepalive; swallow any error. |
| `navigator.sendBeacon` undefined | Skip directly to fetch keepalive. |
| JSON.stringify circular | Buffer serialization marks `kind: 'circular'`; log continues. |
| Backend down | Buffer fills up to 1000; oldest dropped; no alert (best-effort). |
| `JSON.stringify(body)` throws in route | Existing 400 path with error details. |

## Testing

| Module | Test focus |
|--------|-----------|
| `frontendLogBuffer.ts` | FIFO order; capacity eviction; serialization per kind; circular reference handling; Error stack capture. |
| `consoleInterceptor.ts` | All 5 methods wrap originals; original still called once; idempotent re-installation; entry shape. |
| `frontendLogFlusher.ts` | Interval tick triggers flush when buffer non-empty; threshold triggers immediate flush; `pagehide` triggers flush; `sendBeacon` mocked; fetch fallback on `sendBeacon === false`; empty buffer no-op; failed fetch swallowed. |
| `Log.ts` (route) | All three body shapes accepted; truncation at `MAX_ENTRY_BYTES`; `413` over `MAX_BATCH_ENTRIES`; `429` when rate-limited; zod 400; single-entry form unchanged. |
| `FrontendLogFile.ts` | Stream created with given options; env vars override defaults. |

Mock `navigator.sendBeacon` and `fetch` via `vi.stubGlobal` / `vi.spyOn` (Vitest, the project's runner). Hono route tests via the existing test harness in `apps/cli/src/test`.

## Configuration Reference

| Variable | Default | Purpose |
|----------|---------|---------|
| `FRONTEND_LOG_MAX_BYTES` | `4096` | Per-entry byte cap before truncation |
| `FRONTEND_LOG_BATCH_MAX` | `200` | Max entries per single request |
| `FRONTEND_LOG_ROTATE_SIZE` | `10MB` | File size that triggers rotation |
| `FRONTEND_LOG_ROTATE_KEEP` | `5` | Number of files retained (current + 4 rotated) |
| `LOG_LEVEL` | `info` | Applies to both `logger` and `frontendLogger` |
| `LOG_TARGET` | `console` | Applies only to main `logger`; `frontendLogger` always streams to file |

## Non-goals (explicit)

- No React ErrorBoundary integration (out of scope per brainstorming).
- No `window.error` / `unhandledrejection` capture.
- No source-map deobfuscation.
- No sampling or log-level filtering on the frontend.
- No UI affordance to view, copy, or download logs.
- No new public route for log metadata (`/api/log-info`).
- No authentication on `/api/log` (desktop-internal, behind localhost).