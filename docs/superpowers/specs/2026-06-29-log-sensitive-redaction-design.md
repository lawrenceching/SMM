# Log Sensitive Information Redaction Design

Date: 2026-06-29
Status: Approved (pending implementation plan)

## Problem

The frontend log streaming pipeline (see `2026-06-29-frontend-console-streaming-design.md`) writes browser `console.*` calls to `browser.log` via `/api/log`. Two production log lines emit `UserConfig` objects that contain API keys (`tmdb.apiKey`, `tvdb.apiKey`, plus `ai.*.apiKey` and `aiProviders[].apiKey`). The full `UserConfig` is JSON-serialized, so the api key values land verbatim in the log file. The local hostname can also leak into any log line that includes a path or URL. Users paste or upload these files when filing bugs, which exposes secrets unintentionally.

## Goal

Ensure sensitive values (api keys, hostname) never reach the log files on disk. Two independent mechanisms run in parallel:

1. **Frontend active redaction** — strip api keys from `UserConfig` before it is handed to `console.log`. Primary defense; survives even if a new log site is added later.
2. **Backend blacklist redaction** — at startup, collect known sensitive strings into an in-memory set; wrap both pino destinations' `write()` to substitute every occurrence with `******` before it lands on disk. Defense in depth for everything we don't know to redact structurally.

Out of scope: server-side `smm.log` field redaction, hot-reload of blacklist when `smm.json` is updated, masking of paths/usernames beyond the hostname value, format-preserving tokenization, audit log of redactions, configurable redaction placeholder, masking of frontend `console` calls other than the two known UserConfig sites.

## Architecture

```
Browser (apps/ui)                                Backend (apps/cli)
─────────────────                                ────────────────
AppLanguageSync                                   server startup
useReloadAppConfig                                     │
   │                                                   ▼
   ▼                                              initSensitiveStrings()
redactUserConfig(config)                                │
   │                                                    ├─ os.hostname() ─────────┐
   ▼                                                    │                          │
console.log("[…] userConfig: {…apiKey:"***"…}")        └─ read smm.json,         │
   │                                                         walk .apiKey,        │
   ▼                                                         drop empty ─────────┤
FrontendLogBuffer                                                                     │
   │                                                                                  ▼
   ▼ flush                                                sensitiveStrings: Set<string>
FrontendLogFlusher                                                                 │
   │                                                                                  │
   ▼                                                                                  │
navigator.sendBeacon(POST /api/log)                                                  │
                                                       POST /api/log                │
                                                          │                          │
                                                          ▼                          │
                                                       frontendLogger.info          │
                                                          │                          │
                                                          ▼                          │
                                                       MaskingDestinationWrapper    │
                                                          │                          │
                                                          ▼                          │
                                                       maskSensitive(line)          │
                                                          │                          │
                                                          ▼                          │
                                                       rotating-file-stream         │
                                                       → browser.log                │
                                                                                  ┌──┘
                                                                                  │
                                                       (also wraps the main        │
                                                        logger's destination,      │
                                                        so smm.log AND console ────┘
                                                        output are masked too)
```

## Frontend Modules (new)

### `apps/ui/src/lib/redactUserConfig.ts`

Pure function. Recursively walks the value; whenever it encounters a key named `apiKey` whose value is a non-empty string, it replaces the value with the literal string `"******"`. Returns a structurally identical but redacted clone. Does not mutate the input.

```ts
export function redactUserConfig<T>(config: T): T
```

Rules:
- Only string-typed apiKey values are replaced. Non-string apiKey values (number, object, etc.) are kept as-is — UserConfig's `apiKey` is always a string, so this is a defensive fallback.
- The entire tree is deep-cloned. Every visited object/array gets a fresh copy; the input is never mutated. (Verified by the "original input not mutated" test.)
- Traversal handles plain objects, arrays, and `null`/`undefined`. Primitives other than the apiKey match are returned unchanged.
- Cycle protection: a `WeakSet` of seen objects is maintained. On a cycle, return `'[Circular]'` as a leaf replacement (mirrors `serializeArg` in `frontendLogBuffer.ts`).
- Empty strings (`""`) for apiKey are left as-is (they leak nothing).

Application sites:
- `apps/ui/src/hooks/userConfig/AppLanguageSync.tsx:37` — wrap `userConfig` with `redactUserConfig` before `JSON.stringify`.
- `apps/ui/src/hooks/userConfig/useReloadAppConfig.ts:35` — wrap `config` with `redactUserConfig` before passing to `console.log`.

## Backend Modules (new)

### `apps/cli/src/utils/sensitiveBlacklist.ts`

In-memory module-level Set with five exports: the masking primitives, an initializer, a test reset, and a destination wrapper used by `logger.ts`.

```ts
export function addSensitiveString(s: string): void
export function maskSensitive(text: string): string
export async function initSensitiveStrings(): Promise<void>
export function wrapWithMasking(inner: NodeJS.WritableStream): NodeJS.WritableStream
export function _resetSensitiveStringsForTests(): void
```

`addSensitiveString(s)`:
- Trim. If the trimmed value is `""`, return without adding (empty string would match every empty field).
- Add to the module-level `Set<string>`. Idempotent.

`maskSensitive(text)`:
- If the set is empty, return `text` unchanged.
- Sort entries by length descending. This guarantees that if both `"abc"` and `"abcdef"` are present, the longer one is substituted first; a shorter one cannot then match the inserted `******` placeholder.
- For each entry, replace all occurrences with `"******"`. Substitution is plain `String#replaceAll` (not regex), so we don't need to escape special characters.
- Empty `text` returns `""`.

`initSensitiveStrings()`:
- **Re-seed semantics**: each call clears the existing set first, then re-populates from current sources. This is intentionally destructive so tests can call it after mutating the config file fixture, and so a future feature (hot-reload via a watcher) can call it without growing duplicates.
- Adds `os.hostname()` via `addSensitiveString`. If hostname is the empty string, it's a no-op. If `os.hostname()` throws, catch, emit `console.warn` with the error, and continue without hostname.
- Reads `getUserConfigPath()` (resolves `%APPDATA%/SMM/smm.json` or platform equivalent). Three outcomes:
  1. File missing → only hostname is in the set. No throw.
  2. File present, valid JSON → walk the parsed object recursively, collect every non-empty string value at any key named `apiKey`, add each.
  3. File present, malformed JSON → emit `console.warn` (NOT the pino logger — this is invoked during `logger.ts` module init, so importing the logger would create a circular dependency) with the parse error, and continue with hostname only. This is best-effort; the frontend redaction is the primary defense.

The recursive apiKey walker is a module-private `walkApiKeys` function. It mirrors `redactUserConfig`'s traversal but only collects apiKey values; cycle protection via a `WeakSet` is included.

`wrapWithMasking(inner)`:
- Returns a `Writable` that proxies every `write()` to the inner stream, transforming the chunk through `maskSensitive` first.
- The chunk is coerced to a UTF-8 string before transformation, then forwarded. Encoding is preserved.
- Used by `logger.ts` to wrap both the main pino destination (smm.log + console) and the frontend log stream (browser.log).
- Putting it in this module (rather than `logger.ts`) keeps `maskSensitive` and its consumer in the same file and makes it directly testable.

`_resetSensitiveStringsForTests()`:
- Clear the set. Used by tests that need a clean state.

### `apps/cli/lib/logger.ts` (extend)

Two changes:

1. At the top of the module, before any `pino(...)` call: `await initSensitiveStrings()`. This guarantees the blacklist is populated before any log line can be written. (The module already uses top-level `await` for `createLogger()`.)
2. Wrap the destination `Writable` for both the main `logger` and `frontendLogger` with `wrapWithMasking` (imported from `@/utils/sensitiveBlacklist`).

Wired:
- The `pino.destination({...})` return value goes through `wrapWithMasking` before being passed to `pino()`.
- `createFrontendLogStream()`'s return value goes through the same `wrapWithMasking`.

Console mode (`LOG_TARGET !== 'file'`): pino's main `logger` in console mode writes to a stream-equivalent. To keep things uniform, the console-mode logger also gets the wrapper around a `pino.destination(1)` (stdout). This means console output is masked too — accepted as a feature, not a bug: anything logged in console is also what we want masked in the file.

## Data Flow Example

User has TMDB api key `tmdb_abcd1234` and hostname `LAWRENCE-PC`. The `useReloadAppConfig` hook fires in production:

1. Frontend: `redactUserConfig(config)` produces a clone where `config.tmdb.apiKey === "******"`, `config.tvdb.apiKey === "******"`, and any `ai.*.apiKey` / `aiProviders[].apiKey` are also `"******"`. Other fields unchanged.
2. `console.log("[useReloadAppConfig] Reloaded user config", redacted)` runs. The browser shows the redacted form in devtools (we accept this — the user can already read the config in the Settings UI).
3. The console interceptor pushes the entry into `FrontendLogBuffer`.
4. Flusher sends the batch via `sendBeacon` to `POST /api/log`.
5. Backend route hands it to `frontendLogger.info({...}, "[frontend] " + msg)`.
6. pino writes the line to the wrapped destination. The line looks like:
   ```
   {"level":30,"time":1782742742479,"appVersion":"1.4.0","msg":"[frontend] [useReloadAppConfig] Reloaded user config {\"tmdb\":{\"host\":\"\",\"apiKey\":\"******\",...},\"tvdb\":{\"apiKey\":\"******\"},...}"}
   ```
7. Wrapper calls `maskSensitive(line)`. `tmdb_abcd1234` is not in the set (frontend already removed it), but if any other line happened to include the raw key, it would be replaced. `LAWRENCE-PC` is in the set and is replaced with `******` everywhere in the line.
8. Rotating stream writes the (now fully masked) line to `browser.log`.

## Error Handling

| Scenario | Behaviour |
|---|---|
| `smm.json` missing at startup | `initSensitiveStrings` succeeds; blacklist contains only hostname (possibly empty). No throw. |
| `smm.json` malformed | `console.warn` with the parse error (NOT the pino logger — see `initSensitiveStrings` rationale above); blacklist contains only hostname. Frontend redaction is the primary defense in this case. |
| User changes api key after startup | Out of sync — backend blacklist still holds the old key. The frontend `redactUserConfig` covers the two known log sites. New api key would be replaced by the frontend's structural redaction. The mismatch is acceptable and explicitly accepted by the user. |
| Cycle in `UserConfig` | `redactUserConfig` returns `'[Circular]'` for the cycle leaf. Backend walker uses the same protection. |
| `os.hostname()` throws | `try/catch` around the call; on throw, emit `console.warn` and continue without adding hostname. |
| `pino.destination()`'s underlying FD closes | Out of scope; existing pino behavior. |
| `maskSensitive` called with non-string | Function signature is `string → string`; non-string callers are a programming error and should not occur. The exported function does not defensively coerce. |

## Testing

| Module | Test focus |
|---|---|
| `redactUserConfig.ts` | Empty input returns empty; `tmdb.apiKey` redacted; `tvdb.apiKey` redacted; `ai: Record<string, {apiKey: string}>` redacted; `aiProviders: Array<{apiKey: string}>` redacted; deep nesting; array elements walked; original input not mutated; non-string apiKey left alone; empty string apiKey left alone; cycle protection; preserves all non-apiKey fields verbatim. |
| `sensitiveBlacklist.ts` (unit) | `addSensitiveString` + `maskSensitive` happy path; empty set returns input unchanged; empty string is NOT added (and would not match even if added); longer-string-first ordering prevents `"abc"` from breaking `"abcdef"`'s replacement; `initSensitiveStrings` with no `smm.json` → only hostname in set; `initSensitiveStrings` with valid `smm.json` fixture → hostname + every non-empty apiKey; `initSensitiveStrings` with malformed JSON → still adds hostname, no throw; `os.hostname()` throw is caught; `_resetSensitiveStringsForTests` clears state. |
| `logger.ts` integration (smoke) | The `wrapWithMasking` helper is exercised directly: pass a mock Writable (e.g. `vi.fn()` returning a stream with a captured `write` spy) as the inner, write a string containing the configured api key, assert the inner stream received the masked string. No need to instantiate a real pino; the wrapper's contract is what matters. |
| `wrapWithMasking.ts` (exported helper) | Empty input passes through; chunk encoding preserved; `maskSensitive` is called per write; underlying `write` errors propagate via the callback. |
| Existing `Log.test.ts` | No change. All 22 existing tests must still pass; this work does not touch the route handler. |
| Existing `frontendLogFlusher.test.ts` | No change. Frontend redaction is applied at log call sites, not in the flusher. |

Test infrastructure notes:
- The backend test creates a temporary `smm.json` under a temp dir, points `USER_DATA_DIR` env at it for the duration of the test, then restores. The blacklist module reads `getUserConfigPath()` from `apps/cli/src/utils/config.ts` which honours `USER_DATA_DIR`.
- The integration test for the destination wrapper uses a captured-array fake Writable (or `vi.fn()` returning a stream) — no real file I/O.

## Configuration Reference

| Variable | Default | Purpose |
|---|---|---|
| `USER_DATA_DIR` | platform default | Override where `initSensitiveStrings` reads `smm.json` from (existing). |
| `FRONTEND_LOG_MAX_BYTES` | `4096` | Unchanged. |
| `LOG_LEVEL` | `info` | Unchanged. |
| `LOG_TARGET` | `console` | Unchanged. Masking applies to file and console output alike. |

No new env vars are introduced.

## Non-goals (explicit)

- No hot-reload of the blacklist when the user edits `smm.json` mid-session.
- No redaction of usernames in file paths (the user did not list it; masking `/Users/lawrence/...` would risk false positives).
- No redaction of `os.userInfo().username` as a separate sensitive value (the username often appears in paths and could be opted in later, but the user's current scope is hostname + api keys only).
- No frontend console-interceptor-level redaction. Console output is intentionally not masked in the browser — the user is on their own machine.
- No telemetry/audit of which entries were redacted.
- No configuration to opt out of redaction.
- No cryptographic hashing or tokenization — fixed `******` placeholder.
- No new public routes or telemetry endpoints.
- No migration of existing `browser.log` files containing the leaked api keys (one-time leak; new writes are clean).
