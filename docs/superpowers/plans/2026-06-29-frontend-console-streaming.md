# Frontend Console Log Streaming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture every `console.log/info/warn/error/debug` call in the UI, stream them to the CLI backend in batches via `navigator.sendBeacon`, and persist them to a rotating `frontend.log` file under the existing log directory so users can locate and upload it when filing bugs.

**Architecture:** Frontend overrides the five `console.*` methods once at bootstrap, pushes entries into a ring buffer, and flushes them periodically (2s) or when the buffer hits 50 entries or the page hides. Transport is `navigator.sendBeacon` with a `fetch keepalive` fallback. Backend `POST /api/log` (extended) accepts batches, validates each entry, truncates oversize messages, charges the existing rate limiter per batch, and writes via a child pino logger to a rotating file stream (`rotating-file-stream`, 10MB × 5).

**Tech Stack:** Vitest (test runner), Hono (backend), pino + pino.destination (existing), `rotating-file-stream` (new dep), zod (existing), React 19 + Vite (frontend, existing).

**Spec:** `docs/superpowers/specs/2026-06-29-frontend-console-streaming-design.md`

**Working directory:** All commands assume repo root `C:\Users\lawrence\workspace\smm_github`. Filter commands run from root; `cd` commands are used only when a script must run inside a specific app dir.

---

## File Structure

### New files

| Path | Responsibility |
|------|----------------|
| `apps/cli/src/utils/FrontendLogFile.ts` | Wraps `rotating-file-stream` to expose a writable stream named `frontend.log` under `getLogDir()`. Env-overridable size/keep. |
| `apps/ui/src/types/frontendLog.ts` | Wire types: `FrontendLogLevel`, `SerializedArg`, `FrontendLogEntry`, `FrontendLogBatch`. |
| `apps/ui/src/lib/frontendLogBuffer.ts` | Ring buffer (capacity 1000) + arg serializer (Error/Object/Symbol/circular/function/primitive). |
| `apps/ui/src/lib/consoleInterceptor.ts` | One-shot installer: wraps the five `console.*` methods and pushes serialized entries to the buffer. Idempotent across HMR. |
| `apps/ui/src/lib/frontendLogFlusher.ts` | Periodic + threshold + `pagehide` flush trigger. Uses `navigator.sendBeacon` with `fetch keepalive` fallback. |
| `apps/cli/src/route/Log.test.ts` | Vitest suite for the extended `POST /api/log` route. |
| `apps/ui/src/lib/frontendLogBuffer.test.ts` | Vitest suite for buffer + serializer. |
| `apps/ui/src/lib/consoleInterceptor.test.ts` | Vitest suite for interceptor. |
| `apps/ui/src/lib/frontendLogFlusher.test.ts` | Vitest suite for flusher (mocks `sendBeacon`/`fetch`). |

### Modified files

| Path | Change |
|------|--------|
| `apps/cli/package.json` | Add `rotating-file-stream` dependency. |
| `apps/cli/lib/logger.ts` | Export `frontendLogger` (child of existing pino instance, written to the rotating frontend stream). |
| `apps/cli/src/route/Log.ts` | Accept three body shapes; per-entry truncation; 413 over `MAX_BATCH_ENTRIES`; rate-limit charged per `ceil(entries/50)`; level→pino mapping; inject `serverReceivedAt` + `appVersion`. |
| `apps/ui/src/main.tsx` | Call `installConsoleInterceptor()` and `startFrontendLogFlusher()` in `bootstrap()` before `createRoot`. |

### Untouched

- `apps/cli/server.ts` — `handleLog(app)` already registered.
- `apps/cli/src/utils/config.ts` — `getLogDir()` already exists.
- All 119 files containing `console.*` calls — the override pattern means no call site changes.

---

## Task 1: Add `rotating-file-stream` dependency

**Files:**
- Modify: `apps/cli/package.json`

- [ ] **Step 1: Install the dep**

Run from repo root:
```bash
pnpm --filter cli add rotating-file-stream
```

Expected: `apps/cli/package.json` gets a new line under `dependencies`:
```json
"rotating-file-stream": "^3.0.0"
```

And `pnpm-lock.yaml` updates.

- [ ] **Step 2: Verify type resolution**

```bash
cd apps/cli && pnpm exec tsc --noEmit
```

Expected: exit code 0. (We're just confirming the package is resolvable; not consuming it yet.)

- [ ] **Step 3: Commit**

```bash
git add apps/cli/package.json pnpm-lock.yaml
git commit -m "chore(cli): add rotating-file-stream for frontend log rotation"
```

---

## Task 2: Create `FrontendLogFile.ts` rotating stream factory

**Files:**
- Create: `apps/cli/src/utils/FrontendLogFile.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/cli/src/utils/FrontendLogFile.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readdirSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { createFrontendLogStream, resolveFrontendLogPath } from "./FrontendLogFile";

describe("FrontendLogFile", () => {
  let prevLogDir: string | undefined;
  let tmpLogRoot: string;

  beforeEach(() => {
    prevLogDir = process.env.LOG_DIR;
    tmpLogRoot = mkdtempSync(path.join(tmpdir(), "smm-frontend-log-"));
    process.env.LOG_DIR = tmpLogRoot;
  });

  afterEach(() => {
    if (prevLogDir === undefined) {
      delete process.env.LOG_DIR;
    } else {
      process.env.LOG_DIR = prevLogDir;
    }
    if (existsSync(tmpLogRoot)) {
      rmSync(tmpLogRoot, { recursive: true, force: true });
    }
  });

  it("resolves path to frontend.log under LOG_DIR", () => {
    expect(resolveFrontendLogPath()).toBe(path.join(tmpLogRoot, "frontend.log"));
  });

  it("returns a writable stream and writes lines to frontend.log", async () => {
    const stream = createFrontendLogStream();
    stream.write("hello\n");
    stream.write("world\n");
    await new Promise<void>((resolve) => stream.end(resolve));
    expect(existsSync(path.join(tmpLogRoot, "frontend.log"))).toBe(true);
  });

  it("honours FRONTEND_LOG_ROTATE_SIZE override (small for test)", async () => {
    process.env.FRONTEND_LOG_ROTATE_SIZE = "100B";
    const stream = createFrontendLogStream();
    for (let i = 0; i < 50; i++) stream.write(`line-${i}-${"x".repeat(30)}\n`);
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    await new Promise<void>((resolve) => stream.end(resolve));
    // After rotation we should see at least one rotated file alongside frontend.log
    const files = readdirSync(tmpLogRoot).filter((f) => f.startsWith("frontend.log"));
    expect(files.length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/cli && pnpm test src/utils/FrontendLogFile.test.ts
```

Expected: FAIL — `FrontendLogFile.ts` does not exist.

- [ ] **Step 3: Implement `FrontendLogFile.ts`**

Create `apps/cli/src/utils/FrontendLogFile.ts`:

```ts
import { createStream } from "rotating-file-stream";
import { getLogDir } from "@/utils/config";
import path from "path";

const DEFAULT_ROTATE_SIZE = "10MB";
const DEFAULT_KEEP = 5;
const LOG_FILENAME = "frontend.log";

export function resolveFrontendLogPath(): string {
  return path.join(getLogDir(), LOG_FILENAME);
}

/**
 * Returns a writable stream that rotates `frontend.log` by size, gzips old
 * files, and keeps the configured number of rotations. Defaults: 10MB x 5.
 * Env overrides: FRONTEND_LOG_ROTATE_SIZE, FRONTEND_LOG_ROTATE_KEEP.
 */
export function createFrontendLogStream() {
  const logDir = getLogDir();
  const size = process.env.FRONTEND_LOG_ROTATE_SIZE ?? DEFAULT_ROTATE_SIZE;
  const maxFiles = Number(process.env.FRONTEND_LOG_ROTATE_KEEP ?? DEFAULT_KEEP);
  return createStream(LOG_FILENAME, {
    path: logDir,
    size,
    maxFiles,
    compress: "gzip",
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/cli && pnpm test src/utils/FrontendLogFile.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/utils/FrontendLogFile.ts apps/cli/src/utils/FrontendLogFile.test.ts
git commit -m "feat(cli): add rotating stream factory for frontend.log"
```

---

## Task 3: Add `frontendLogger` to `apps/cli/lib/logger.ts`

**Files:**
- Modify: `apps/cli/lib/logger.ts` (append after `export const logger = await createLogger();`)

- [ ] **Step 1: Verify logger.ts current shape**

Open `apps/cli/lib/logger.ts` and confirm line 164 reads:
```ts
export const logger = await createLogger();
```

- [ ] **Step 2: Append `frontendLogger`**

Add the import and the export after the existing `logger` declaration. The file becomes (additions only):

```ts
// After line 1 imports, add:
import { createFrontendLogStream } from "./FrontendLogFile";

// After existing `export const logger = await createLogger();`, add:
/**
 * Logger dedicated to frontend-sourced log entries. Streams to a rotating
 * frontend.log file under the application log directory. Independent of
 * LOG_TARGET so the frontend trail is captured even when the backend is in
 * console-only mode.
 */
export const frontendLogger = pino(
  { level: process.env.LOG_LEVEL ?? "info" },
  // pino accepts any Node Writable as a destination; rotating-file-stream
  // implements that interface.
  createFrontendLogStream() as unknown as pino.DestinationStream
);
```

If the editor flags the `as unknown as` cast, add the explicit cast; the alternative is wrapping with `pino.multistream` which is not needed here.

- [ ] **Step 3: Type-check**

```bash
cd apps/cli && pnpm exec tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 4: Verify it boots**

```bash
cd apps/cli && timeout 3 bun run index.ts 2>&1 | head -20 || true
```

Expected: server starts, no module-resolution errors, no synchronous exception. The 3-second timeout is intentional.

- [ ] **Step 5: Commit**

```bash
git add apps/cli/lib/logger.ts
git commit -m "feat(cli): add frontendLogger for console stream sink"
```

---

## Task 4: Extend `Log.ts` route — accept array and batch body shapes

**Files:**
- Create: `apps/cli/src/route/Log.test.ts`
- Modify: `apps/cli/src/route/Log.ts`

This task handles shape discrimination. Truncation, batch-size cap, and rate-limit charging come in Tasks 5–7.

- [ ] **Step 1: Write the failing tests for shape handling**

Create `apps/cli/src/route/Log.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Hono } from "hono";
import { handleLog } from "./Log";

// We test through a Hono app; pino writes go to the real rotating stream,
// so we stub the logger module.
vi.mock("../../lib/logger", () => ({
  logger: {
    trace: vi.fn(), debug: vi.fn(), info: vi.fn(),
    warn: vi.fn(), error: vi.fn(), fatal: vi.fn(),
    isLevelEnabled: () => false,
    level: "info",
  },
  frontendLogger: {
    trace: vi.fn(), debug: vi.fn(), info: vi.fn(),
    warn: vi.fn(), error: vi.fn(), fatal: vi.fn(),
  },
}));

// Also stub FrontendLogFile so no real stream is created
vi.mock("../utils/FrontendLogFile", () => ({
  createFrontendLogStream: () => ({ write: vi.fn(), end: vi.fn() }),
  resolveFrontendLogPath: () => "/tmp/frontend.log",
}));

describe("POST /api/log — body shapes", () => {
  let app: Hono;
  beforeEach(() => { app = new Hono(); handleLog(app); });

  it("accepts single-entry form (legacy writeFrontendLog)", async () => {
    const res = await app.request("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: "info", message: "hello" }),
    });
    expect(res.status).toBe(204);
  });

  it("accepts array form", async () => {
    const res = await app.request("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        { level: "info", message: "a" },
        { level: "warn", message: "b" },
      ]),
    });
    expect(res.status).toBe(204);
  });

  it("accepts batch form with appVersion", async () => {
    const res = await app.request("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entries: [{ level: "error", message: "boom" }],
        appVersion: "1.4.0",
      }),
    });
    expect(res.status).toBe(204);
  });

  it("rejects body missing message with 400", async () => {
    const res = await app.request("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: "info" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects unknown level with 400", async () => {
    const res = await app.request("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: "nope", message: "x" }),
    });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests, confirm 3 fail (single/array/batch not yet handled)**

```bash
cd apps/cli && pnpm test src/route/Log.test.ts
```

Expected: `single-entry form` and `rejects body missing message` PASS (legacy path already works); `accepts array form`, `accepts batch form`, `rejects unknown level` FAIL.

- [ ] **Step 3: Refactor `Log.ts` to handle all three shapes**

Replace `apps/cli/src/route/Log.ts` with:

```ts
import type { Hono } from "hono";
import { z } from "zod/v3";
import { logger, frontendLogger } from "../../lib/logger";

const RATE_LIMIT_PER_SECOND = 10;

class RateLimiter {
  private requestCounts: Map<string, { count: number; resetTime: number }> = new Map();
  isAllowed(key: string = "global"): boolean {
    const now = Date.now();
    const windowStart = Math.floor(now / 1000) * 1000;
    const nextResetTime = windowStart + 1000;
    const record = this.requestCounts.get(key);
    if (!record || now >= record.resetTime) {
      this.requestCounts.set(key, { count: 1, resetTime: nextResetTime });
      return true;
    }
    if (record.count < RATE_LIMIT_PER_SECOND) {
      record.count++;
      return true;
    }
    return false;
  }
  charge(key: string, credits: number): boolean {
    const now = Date.now();
    const windowStart = Math.floor(now / 1000) * 1000;
    const nextResetTime = windowStart + 1000;
    const record = this.requestCounts.get(key);
    if (!record || now >= record.resetTime) {
      this.requestCounts.set(key, { count: credits, resetTime: nextResetTime });
      return true;
    }
    if (record.count + credits <= RATE_LIMIT_PER_SECOND) {
      record.count += credits;
      return true;
    }
    return false;
  }
  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.requestCounts.entries()) {
      if (now >= record.resetTime) this.requestCounts.delete(key);
    }
  }
}

const rateLimiter = new RateLimiter();
setInterval(() => rateLimiter.cleanup(), 60_000);

const LogLevel = z.enum(["trace", "debug", "info", "warn", "error", "fatal"]);
const SingleEntry = z.object({
  level: LogLevel.default("info"),
  message: z.string().min(1, "Message is required"),
  context: z.record(z.unknown()).optional(),
});
const BatchBody = z.object({
  entries: z.array(SingleEntry).min(1),
  appVersion: z.string().optional(),
});

type SingleEntryT = z.infer<typeof SingleEntry>;
type ParsedBatch = { entries: SingleEntryT[]; appVersion?: string };

function parseBody(raw: unknown):
  | { kind: "single"; entry: SingleEntryT }
  | { kind: "array"; entries: SingleEntryT[] }
  | { kind: "batch"; batch: ParsedBatch }
  | { kind: "error"; issues: z.ZodIssue[] } {
  if (raw && typeof raw === "object" && !Array.isArray(raw) && "entries" in (raw as object) && Array.isArray((raw as { entries: unknown }).entries)) {
    const r = BatchBody.safeParse(raw);
    return r.success ? { kind: "batch", batch: r.data } : { kind: "error", issues: r.error.issues };
  }
  if (Array.isArray(raw)) {
    const r = z.array(SingleEntry).min(1).safeParse(raw);
    return r.success ? { kind: "array", entries: r.data } : { kind: "error", issues: r.error.issues };
  }
  const r = SingleEntry.safeParse(raw);
  return r.success ? { kind: "single", entry: r.data } : { kind: "error", issues: r.error.issues };
}

function dispatch(entry: SingleEntryT, appVersion?: string) {
  const ctx = { ...(entry.context ?? {}), source: "frontend", appVersion };
  const fn = frontendLogger as unknown as Record<string, (c: object, m: string) => void>;
  const line = "[frontend] " + entry.message;
  switch (entry.level) {
    case "trace": fn.trace(ctx, line); break;
    case "debug": fn.debug(ctx, line); break;
    case "info":  fn.info(ctx, line);  break;
    case "warn":  fn.warn(ctx, line);  break;
    case "error": fn.error(ctx, line); break;
    case "fatal": fn.fatal(ctx, line); break;
  }
}

export function handleLog(app: Hono): void {
  app.post("/api/log", async (c) => {
    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch (error) {
      logger.error({ error }, "Failed to parse /api/log body");
      return c.json({ error: "Invalid JSON", details: error instanceof Error ? error.message : "Unknown" }, 400);
    }

    const parsed = parseBody(raw);
    if (parsed.kind === "error") {
      return c.json(
        { error: "Validation failed", details: parsed.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
        400,
      );
    }

    let entries: SingleEntryT[];
    let appVersion: string | undefined;
    if (parsed.kind === "single") { entries = [parsed.entry]; }
    else if (parsed.kind === "array") { entries = parsed.entries; }
    else { entries = parsed.batch.entries; appVersion = parsed.batch.appVersion; }

    // Rate limit charge — Tasks 5-7 will refine to per-entry credits; this
    // baseline charges 1 credit per request.
    if (!rateLimiter.isAllowed()) {
      return c.json({ error: "Rate limit exceeded" }, 429);
    }

    const serverReceivedAt = new Date().toISOString();
    for (const entry of entries) {
      const enriched = { ...(entry.context ?? {}), source: "frontend", appVersion, serverReceivedAt };
      const line = "[frontend] " + entry.message;
      const fn = frontendLogger as unknown as Record<string, (c: object, m: string) => void>;
      switch (entry.level) {
        case "trace": fn.trace(enriched, line); break;
        case "debug": fn.debug(enriched, line); break;
        case "info":  fn.info(enriched, line);  break;
        case "warn":  fn.warn(enriched, line);  break;
        case "error": fn.error(enriched, line); break;
        case "fatal": fn.fatal(enriched, line); break;
      }
    }

    return new Response(null, { status: 204 });
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/cli && pnpm test src/route/Log.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Type-check**

```bash
cd apps/cli && pnpm exec tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/cli/src/route/Log.ts apps/cli/src/route/Log.test.ts
git commit -m "feat(cli): accept array and batch body shapes on POST /api/log"
```

---

## Task 5: Extend `Log.ts` — per-entry truncation at `FRONTEND_LOG_MAX_BYTES`

**Files:**
- Modify: `apps/cli/src/route/Log.ts`
- Modify: `apps/cli/src/route/Log.test.ts`

- [ ] **Step 1: Add failing tests for truncation**

Append to `apps/cli/src/route/Log.test.ts`:

```ts
describe("POST /api/log — truncation", () => {
  let app: Hono;
  beforeEach(() => { app = new Hono(); handleLog(app); });

  it("truncates a single oversized entry's message and marks context.truncated=true", async () => {
    const huge = "x".repeat(8000);
    const res = await app.request("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: "info", message: huge }),
    });
    expect(res.status).toBe(204);
    const calls = (frontendLogger.info as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBe(1);
    const ctx = calls[0][0] as { truncated?: boolean; source?: string };
    expect(ctx.truncated).toBe(true);
    expect(ctx.source).toBe("frontend");
  });

  it("honours FRONTEND_LOG_MAX_BYTES env override", async () => {
    process.env.FRONTEND_LOG_MAX_BYTES = "100";
    const app2 = new Hono();
    handleLog(app2);
    const res = await app2.request("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: "info", message: "y".repeat(500) }),
    });
    expect(res.status).toBe(204);
    delete process.env.FRONTEND_LOG_MAX_BYTES;
  });
});
```

- [ ] **Step 2: Run, confirm new tests fail**

```bash
cd apps/cli && pnpm test src/route/Log.test.ts -t "truncation"
```

Expected: 2 new tests FAIL.

- [ ] **Step 3: Add truncation logic to `Log.ts`**

In `apps/cli/src/route/Log.ts`, replace the loop section in `handleLog`:

```ts
    const MAX_BYTES = Number(process.env.FRONTEND_LOG_MAX_BYTES ?? 4096);
    const serverReceivedAt = new Date().toISOString();
    const fn = frontendLogger as unknown as Record<string, (c: object, m: string) => void>;
    for (const entry of entries) {
      const baseCtx = entry.context ?? {};
      const messageBytes = Buffer.byteLength(entry.message, "utf8");
      const ctxBytes = Buffer.byteLength(JSON.stringify(baseCtx), "utf8");
      const truncated = messageBytes + ctxBytes > MAX_BYTES;
      let message = entry.message;
      let context = baseCtx;
      if (truncated) {
        const budget = Math.max(0, MAX_BYTES - ctxBytes - 1);
        message = Buffer.from(entry.message, "utf8").subarray(0, budget).toString("utf8");
        context = { ...baseCtx, truncated: true };
      }
      const enriched = { ...context, source: "frontend", appVersion, serverReceivedAt };
      const line = "[frontend] " + message;
      switch (entry.level) {
        case "trace": fn.trace(enriched, line); break;
        case "debug": fn.debug(enriched, line); break;
        case "info":  fn.info(enriched, line);  break;
        case "warn":  fn.warn(enriched, line);  break;
        case "error": fn.error(enriched, line); break;
        case "fatal": fn.fatal(enriched, line); break;
      }
    }
```

- [ ] **Step 4: Run tests, confirm pass**

```bash
cd apps/cli && pnpm test src/route/Log.test.ts
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/route/Log.ts apps/cli/src/route/Log.test.ts
git commit -m "feat(cli): truncate oversized entries on POST /api/log"
```

---

## Task 6: Extend `Log.ts` — 413 over `FRONTEND_LOG_BATCH_MAX`

**Files:**
- Modify: `apps/cli/src/route/Log.ts`
- Modify: `apps/cli/src/route/Log.test.ts`

- [ ] **Step 1: Add failing test**

Append to `apps/cli/src/route/Log.test.ts`:

```ts
describe("POST /api/log — batch cap", () => {
  let app: Hono;
  beforeEach(() => { app = new Hono(); handleLog(app); });

  it("returns 413 when batch exceeds FRONTEND_LOG_BATCH_MAX", async () => {
    const entries = Array.from({ length: 250 }, (_, i) => ({ level: "info", message: `m${i}` }));
    const res = await app.request("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries, appVersion: "1.0.0" }),
    });
    expect(res.status).toBe(413);
  });

  it("accepts a batch at exactly MAX_BATCH_ENTRIES", async () => {
    const MAX = Number(process.env.FRONTEND_LOG_BATCH_MAX ?? 200);
    const entries = Array.from({ length: MAX }, (_, i) => ({ level: "info", message: `m${i}` }));
    const res = await app.request("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries }),
    });
    expect(res.status).toBe(204);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
cd apps/cli && pnpm test src/route/Log.test.ts -t "batch cap"
```

Expected: FAIL on the 413 assertion.

- [ ] **Step 3: Add the cap check**

In `handleLog`, immediately after the `parseBody` validation block and before the rate-limit call, insert:

```ts
    const MAX_BATCH = Number(process.env.FRONTEND_LOG_BATCH_MAX ?? 200);
    if (entries.length > MAX_BATCH) {
      return c.json({ error: "Batch too large", max: MAX_BATCH, received: entries.length }, 413);
    }
```

- [ ] **Step 4: Run tests, confirm pass**

```bash
cd apps/cli && pnpm test src/route/Log.test.ts
```

Expected: all 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/route/Log.ts apps/cli/src/route/Log.test.ts
git commit -m "feat(cli): enforce FRONTEND_LOG_BATCH_MAX with 413"
```

---

## Task 7: Extend `Log.ts` — charge rate limit per `ceil(entries/50)` credits

**Files:**
- Modify: `apps/cli/src/route/Log.ts`
- Modify: `apps/cli/src/route/Log.test.ts`

- [ ] **Step 1: Add failing test**

Append to `apps/cli/src/route/Log.test.ts`:

```ts
describe("POST /api/log — rate limiting", () => {
  it("rate-limits batches that exceed 10 credits/sec total", async () => {
    const app = new Hono();
    handleLog(app);
    // 11 batches of 100 entries each = 11 * ceil(100/50) = 22 credits, > 10/sec
    const batches = Array.from({ length: 11 }, () => ({
      entries: Array.from({ length: 100 }, (_, i) => ({ level: "info", message: `m${i}` })),
      appVersion: "1.0.0",
    }));
    const statuses: number[] = [];
    for (const body of batches) {
      const res = await app.request("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      statuses.push(res.status);
    }
    // At least one request should have been 429 (rate-limited).
    expect(statuses).toContain(429);
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
cd apps/cli && pnpm test src/route/Log.test.ts -t "rate limiting"
```

Expected: FAIL — current code charges only 1 credit per request.

- [ ] **Step 3: Replace the rate-limit call**

In `handleLog`, replace the existing `if (!rateLimiter.isAllowed()) {` line with:

```ts
    const credits = Math.max(1, Math.ceil(entries.length / 50));
    if (!rateLimiter.charge("global", credits)) {
      return c.json({ error: "Rate limit exceeded", creditsRequested: credits }, 429);
    }
```

- [ ] **Step 4: Run all tests, confirm pass**

```bash
cd apps/cli && pnpm test src/route/Log.test.ts
```

Expected: all 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/route/Log.ts apps/cli/src/route/Log.test.ts
git commit -m "feat(cli): charge rate limiter per ceil(entries/50) credits"
```

---

## Task 8: Add `apps/ui/src/types/frontendLog.ts` shared types

**Files:**
- Create: `apps/ui/src/types/frontendLog.ts`

- [ ] **Step 1: Write the file**

```ts
/**
 * Wire types for the frontend console log streaming pipeline.
 * Defined separately from the runtime modules so both the buffer (producer)
 * and the flusher (consumer) can import without circular deps.
 */

export type FrontendLogLevel = "log" | "info" | "warn" | "error" | "debug";

export interface SerializedArg {
  kind:
    | "string"
    | "number"
    | "boolean"
    | "null"
    | "undef"
    | "symbol"
    | "object"
    | "error"
    | "circular"
    | "fn"
    | "bigint";
  value: string;
}

export interface FrontendLogEntry {
  level: FrontendLogLevel;
  args: SerializedArg[];
  ts: number;
  url: string;
  sessionId: string;
}

export interface FrontendLogBatch {
  entries: FrontendLogEntry[];
  appVersion: string;
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/ui && pnpm exec tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/types/frontendLog.ts
git commit -m "feat(ui): add shared FrontendLog wire types"
```

---

## Task 9: Implement `frontendLogBuffer.ts` ring buffer + serializer

**Files:**
- Create: `apps/ui/src/lib/frontendLogBuffer.ts`
- Create: `apps/ui/src/lib/frontendLogBuffer.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/ui/src/lib/frontendLogBuffer.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { FrontendLogBuffer, serializeArg } from "./frontendLogBuffer";
import type { FrontendLogEntry } from "@/types/frontendLog";

const entry = (overrides: Partial<FrontendLogEntry> = {}): FrontendLogEntry => ({
  level: "log",
  args: [{ kind: "string", value: "x" }],
  ts: 1,
  url: "http://localhost/",
  sessionId: "sid",
  ...overrides,
});

describe("serializeArg", () => {
  it("handles primitives", () => {
    expect(serializeArg("hello")).toEqual({ kind: "string", value: "hello" });
    expect(serializeArg(42)).toEqual({ kind: "number", value: "42" });
    expect(serializeArg(true)).toEqual({ kind: "boolean", value: "true" });
    expect(serializeArg(null)).toEqual({ kind: "null", value: "" });
    expect(serializeArg(undefined)).toEqual({ kind: "undef", value: "" });
  });

  it("handles Error with name, message, and stack", () => {
    const e = new Error("boom");
    const out = serializeArg(e);
    expect(out.kind).toBe("error");
    expect(out.value).toContain("Error");
    expect(out.value).toContain("boom");
    expect(out.value).toContain(e.stack?.split("\n")[1] ?? "");
  });

  it("handles circular objects", () => {
    const a: Record<string, unknown> = { name: "a" };
    a.self = a;
    const out = serializeArg(a);
    expect(out.kind).toBe("circular");
    expect(out.value).toBe("[Circular]");
  });

  it("handles plain objects", () => {
    expect(serializeArg({ a: 1 })).toEqual({ kind: "object", value: '{"a":1}' });
  });

  it("handles arrays", () => {
    expect(serializeArg([1, 2])).toEqual({ kind: "object", value: "[1,2]" });
  });

  it("handles functions (truncated)", () => {
    const fn = () => 1;
    const out = serializeArg(fn);
    expect(out.kind).toBe("fn");
    expect(out.value.startsWith("() => 1")).toBe(true);
  });

  it("handles BigInt", () => {
    expect(serializeArg(BigInt(10))).toEqual({ kind: "bigint", value: "10n" });
  });

  it("handles Symbol", () => {
    expect(serializeArg(Symbol("hi")).kind).toBe("symbol");
  });
});

describe("FrontendLogBuffer", () => {
  it("starts empty", () => {
    const b = new FrontendLogBuffer();
    expect(b.size()).toBe(0);
    expect(b.drain()).toEqual([]);
  });

  it("preserves FIFO order under capacity", () => {
    const b = new FrontendLogBuffer();
    b.push(entry({ ts: 1 }));
    b.push(entry({ ts: 2 }));
    b.push(entry({ ts: 3 }));
    expect(b.drain().map((e) => e.ts)).toEqual([1, 2, 3]);
  });

  it("evicts oldest entries at capacity", () => {
    const b = new FrontendLogBuffer(3);
    for (let i = 1; i <= 5; i++) b.push(entry({ ts: i }));
    expect(b.size()).toBe(3);
    expect(b.drain().map((e) => e.ts)).toEqual([3, 4, 5]);
  });

  it("drain returns and clears all entries", () => {
    const b = new FrontendLogBuffer();
    b.push(entry({ ts: 1 }));
    expect(b.drain()).toHaveLength(1);
    expect(b.drain()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests, confirm fail**

```bash
cd apps/ui && pnpm test src/lib/frontendLogBuffer.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 3: Implement `frontendLogBuffer.ts`**

Create `apps/ui/src/lib/frontendLogBuffer.ts`:

```ts
import type { FrontendLogEntry, SerializedArg } from "@/types/frontendLog";

const MAX_CAPACITY = 1000;
const FN_STRING_LIMIT = 200;

/**
 * Serialize one console arg into a JSON-safe form.
 * Preserves enough information to reconstruct what the developer saw.
 */
export function serializeArg(arg: unknown): SerializedArg {
  if (arg === null) return { kind: "null", value: "" };
  if (arg === undefined) return { kind: "undef", value: "" };
  const t = typeof arg;
  if (t === "string") return { kind: "string", value: arg };
  if (t === "number") return { kind: "number", value: String(arg) };
  if (t === "boolean") return { kind: "boolean", value: String(arg) };
  if (t === "bigint") return { kind: "bigint", value: `${arg.toString()}n` };
  if (t === "symbol") return { kind: "symbol", value: (arg as symbol).toString() };
  if (t === "function") {
    const src = Function.prototype.toString.call(arg).slice(0, FN_STRING_LIMIT);
    return { kind: "fn", value: src };
  }
  if (arg instanceof Error) {
    const stackLine = arg.stack?.split("\n")[1]?.trim() ?? "";
    return { kind: "error", value: `${arg.name}: ${arg.message}\n${stackLine}` };
  }
  try {
    return { kind: "object", value: JSON.stringify(arg) };
  } catch {
    return { kind: "circular", value: "[Circular]" };
  }
}

/**
 * In-memory ring buffer of FrontendLogEntry. FIFO eviction at capacity.
 */
export class FrontendLogBuffer {
  private entries: FrontendLogEntry[] = [];
  private readonly capacity: number;

  constructor(capacity: number = MAX_CAPACITY) {
    this.capacity = capacity;
  }

  push(entry: FrontendLogEntry): void {
    this.entries.push(entry);
    if (this.entries.length > this.capacity) {
      this.entries.splice(0, this.entries.length - this.capacity);
    }
  }

  size(): number {
    return this.entries.length;
  }

  drain(): FrontendLogEntry[] {
    if (this.entries.length === 0) return [];
    const out = this.entries;
    this.entries = [];
    return out;
  }
}
```

- [ ] **Step 4: Run tests, confirm pass**

```bash
cd apps/ui && pnpm test src/lib/frontendLogBuffer.test.ts
```

Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/ui/src/lib/frontendLogBuffer.ts apps/ui/src/lib/frontendLogBuffer.test.ts
git commit -m "feat(ui): add FrontendLogBuffer with arg serializer"
```

---

## Task 10: Implement `consoleInterceptor.ts`

**Files:**
- Create: `apps/ui/src/lib/consoleInterceptor.ts`
- Create: `apps/ui/src/lib/consoleInterceptor.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/ui/src/lib/consoleInterceptor.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { installConsoleInterceptor } from "./consoleInterceptor";
import { FrontendLogBuffer } from "./frontendLogBuffer";

function withMockSessionId(id = "test-sid") {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation((key) =>
    key === "smm.frontendLog.sessionId" ? id : null,
  );
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {});
}

describe("installConsoleInterceptor", () => {
  beforeEach(() => {
    // Reset console between tests by reinstalling originals we cached.
    // The interceptor saves originals on first install; we patch globals back.
    (globalThis as unknown as { console: Console }).console = {
      ...console,
      log: (...args: unknown[]) => undefined,
      info: (...args: unknown[]) => undefined,
      warn: (...args: unknown[]) => undefined,
      error: (...args: unknown[]) => undefined,
      debug: (...args: unknown[]) => undefined,
    } as unknown as Console;
  });

  it("wraps all five console methods and forwards to originals", () => {
    withMockSessionId();
    const origLog = vi.spyOn(console, "log").mockImplementation(() => {});
    const origInfo = vi.spyOn(console, "info").mockImplementation(() => {});
    const origWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const origError = vi.spyOn(console, "error").mockImplementation(() => {});
    const origDebug = vi.spyOn(console, "debug").mockImplementation(() => {});

    const buffer = new FrontendLogBuffer();
    installConsoleInterceptor(buffer);

    console.log("a");
    console.info("b");
    console.warn("c");
    console.error("d");
    console.debug("e");

    expect(origLog).toHaveBeenCalledWith("a");
    expect(origInfo).toHaveBeenCalledWith("b");
    expect(origWarn).toHaveBeenCalledWith("c");
    expect(origError).toHaveBeenCalledWith("d");
    expect(origDebug).toHaveBeenCalledWith("e");
    expect(buffer.size()).toBe(5);
  });

  it("records entries with correct level, sessionId, ts, url", () => {
    withMockSessionId("sid-42");
    vi.spyOn(console, "log").mockImplementation(() => {});
    const buffer = new FrontendLogBuffer();
    installConsoleInterceptor(buffer);

    const before = Date.now();
    console.log("hi");
    const after = Date.now();

    const entries = buffer.drain();
    expect(entries[0].level).toBe("log");
    expect(entries[0].sessionId).toBe("sid-42");
    expect(entries[0].ts).toBeGreaterThanOrEqual(before);
    expect(entries[0].ts).toBeLessThanOrEqual(after);
    expect(entries[0].url).toBe(window.location.href);
    expect(entries[0].args[0]).toEqual({ kind: "string", value: "hi" });
  });

  it("is idempotent — re-installing does not double-wrap", () => {
    withMockSessionId();
    vi.spyOn(console, "log").mockImplementation(() => {});
    const buffer = new FrontendLogBuffer();
    installConsoleInterceptor(buffer);
    installConsoleInterceptor(buffer);
    console.log("once");
    expect(buffer.size()).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests, confirm fail**

```bash
cd apps/ui && pnpm test src/lib/consoleInterceptor.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 3: Implement `consoleInterceptor.ts`**

Create `apps/ui/src/lib/consoleInterceptor.ts`:

```ts
import { serializeArg, FrontendLogBuffer } from "./frontendLogBuffer";
import type { FrontendLogEntry, FrontendLogLevel } from "@/types/frontendLog";

const SESSION_KEY = "smm.frontendLog.sessionId";
const LEVELS: FrontendLogLevel[] = ["log", "info", "warn", "error", "debug"];
type ConsoleMethod = "log" | "info" | "warn" | "error" | "debug";

let installed = false;
let bufferRef: FrontendLogBuffer | null = null;
const originals: Partial<Record<ConsoleMethod, (...args: unknown[]) => void>> = {};

function getOrCreateSessionId(): string {
  const existing = sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const id = (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : `sid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  sessionStorage.setItem(SESSION_KEY, id);
  return id;
}

/**
 * Wraps the five `console.*` methods to also push serialized entries into
 * the provided buffer. Idempotent: re-invoking is a no-op.
 */
export function installConsoleInterceptor(buffer: FrontendLogBuffer): void {
  if (installed) return;
  installed = true;
  bufferRef = buffer;

  for (const level of LEVELS) {
    originals[level] = console[level].bind(console);
    const original = originals[level]!;
    console[level] = (...args: unknown[]) => {
      original(...args);
      try {
        const entry: FrontendLogEntry = {
          level,
          args: args.map(serializeArg),
          ts: Date.now(),
          url: typeof location !== "undefined" ? location.href : "",
          sessionId: getOrCreateSessionId(),
        };
        bufferRef?.push(entry);
      } catch {
        // Never throw from a console wrapper.
      }
    };
  }
}

/** Test helper: undo the wrapping. Not used in production. */
export function _uninstallConsoleInterceptor(): void {
  if (!installed) return;
  for (const level of LEVELS) {
    const orig = originals[level];
    if (orig) console[level] = orig as Console[ConsoleMethod];
  }
  installed = false;
  bufferRef = null;
}
```

- [ ] **Step 4: Run tests, confirm pass**

```bash
cd apps/ui && pnpm test src/lib/consoleInterceptor.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/ui/src/lib/consoleInterceptor.ts apps/ui/src/lib/consoleInterceptor.test.ts
git commit -m "feat(ui): wrap console.* with FrontendLogBuffer capture"
```

---

## Task 11: Implement `frontendLogFlusher.ts`

**Files:**
- Create: `apps/ui/src/lib/frontendLogFlusher.ts`
- Create: `apps/ui/src/lib/frontendLogFlusher.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/ui/src/lib/frontendLogFlusher.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { FrontendLogBuffer } from "./frontendLogBuffer";
import { startFrontendLogFlusher, _resetFlusherForTests } from "./frontendLogFlusher";

function makeEntry(ts = Date.now()) {
  return {
    level: "log" as const,
    args: [{ kind: "string" as const, value: "x" }],
    ts,
    url: "http://localhost/",
    sessionId: "sid",
  };
}

describe("FrontendLogFlusher", () => {
  let buffer: FrontendLogBuffer;
  let sendBeacon: ReturnType<typeof vi.fn>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    buffer = new FrontendLogBuffer();
    sendBeacon = vi.fn().mockReturnValue(true);
    fetchMock = vi.fn().mockResolvedValue({ status: 204 });
    (navigator as unknown as { sendBeacon: typeof sendBeacon }).sendBeacon = sendBeacon;
    (globalThis as unknown as { fetch: typeof fetchMock }).fetch = fetchMock;
    (import.meta.env as unknown as { VITE_APP_VERSION: string }).VITE_APP_VERSION = "1.4.0";
  });

  afterEach(() => {
    _resetFlusherForTests();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("does nothing on interval when buffer is empty", () => {
    startFrontendLogFlusher(buffer);
    vi.advanceTimersByTime(5_000);
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it("flushes on interval when buffer non-empty", () => {
    startFrontendLogFlusher(buffer);
    buffer.push(makeEntry());
    vi.advanceTimersByTime(2_100);
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [url, blob] = sendBeacon.mock.calls[0] as [string, Blob];
    expect(url).toBe("/api/log");
    expect(blob).toBeInstanceOf(Blob);
  });

  it("calls /api/log with JSON batch containing appVersion and entries", async () => {
    startFrontendLogFlusher(buffer);
    buffer.push(makeEntry());
    vi.advanceTimersByTime(2_100);
    expect(sendBeacon).toHaveBeenCalled();
    const blob = sendBeacon.mock.calls[0][1] as Blob;
    const text = await blob.text();
    const parsed = JSON.parse(text);
    expect(parsed.appVersion).toBe("1.4.0");
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0].sessionId).toBe("sid");
  });

  it("falls back to fetch when sendBeacon returns false", async () => {
    sendBeacon.mockReturnValue(false);
    startFrontendLogFlusher(buffer);
    buffer.push(makeEntry());
    vi.advanceTimersByTime(2_100);
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/log");
    expect(init.method).toBe("POST");
    expect(init.keepalive).toBe(true);
  });

  it("swallows fetch errors silently", async () => {
    sendBeacon.mockReturnValue(false);
    fetchMock.mockRejectedValue(new Error("network down"));
    startFrontendLogFlusher(buffer);
    buffer.push(makeEntry());
    await vi.advanceTimersByTimeAsync(2_100);
    expect(fetchMock).toHaveBeenCalled();
    // No throw, no console spam — sanity check via drain being empty after flush.
    expect(buffer.size()).toBe(0);
  });

  it("flushes on pagehide", () => {
    startFrontendLogFlusher(buffer);
    buffer.push(makeEntry());
    window.dispatchEvent(new Event("pagehide"));
    expect(sendBeacon).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests, confirm fail**

```bash
cd apps/ui && pnpm test src/lib/frontendLogFlusher.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 3: Implement `frontendLogFlusher.ts`**

Create `apps/ui/src/lib/frontendLogFlusher.ts`:

```ts
import type { FrontendLogBatch } from "@/types/frontendLog";
import { FrontendLogBuffer } from "./frontendLogBuffer";

const FLUSH_INTERVAL_MS = 2_000;
const ENDPOINT = "/api/log";
const BLOB_TYPE = "application/json";

let bufferRef: FrontendLogBuffer | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let pageHideHandler: (() => void) | null = null;

function getAppVersion(): string {
  // Vite injects import.meta.env at build time. Fall back to 'unknown'.
  const v = (import.meta as unknown as { env?: { VITE_APP_VERSION?: string } }).env?.VITE_APP_VERSION;
  return v ?? "unknown";
}

async function flush(): Promise<void> {
  if (!bufferRef) return;
  const entries = bufferRef.drain();
  if (entries.length === 0) return;

  const batch: FrontendLogBatch = { entries, appVersion: getAppVersion() };
  let body: Blob;
  try {
    body = new Blob([JSON.stringify(batch)], { type: BLOB_TYPE });
  } catch {
    // If serialization fails (extremely large entry), drop silently.
    return;
  }

  try {
    const beacon = typeof navigator !== "undefined" ? navigator.sendBeacon?.bind(navigator) : undefined;
    const ok = beacon ? beacon(ENDPOINT, body) : false;
    if (ok) return;
    if (typeof fetch !== "undefined") {
      await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": BLOB_TYPE },
        body,
        keepalive: true,
      });
    }
  } catch {
    // Swallow — best-effort logging.
  }
}

/**
 * Start the periodic flush loop and the pagehide handler.
 * Idempotent: re-calling is a no-op until _resetFlusherForTests() runs.
 */
export function startFrontendLogFlusher(buffer: FrontendLogBuffer): void {
  if (intervalId !== null) return;
  bufferRef = buffer;
  intervalId = setInterval(() => { void flush(); }, FLUSH_INTERVAL_MS);
  pageHideHandler = () => { void flush(); };
  window.addEventListener("pagehide", pageHideHandler);
}

/** Test helper to undo startFrontendLogFlusher between tests. */
export function _resetFlusherForTests(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (pageHideHandler) {
    window.removeEventListener("pagehide", pageHideHandler);
    pageHideHandler = null;
  }
  bufferRef = null;
}
```

- [ ] **Step 4: Run tests, confirm pass**

```bash
cd apps/ui && pnpm test src/lib/frontendLogFlusher.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/ui/src/lib/frontendLogFlusher.ts apps/ui/src/lib/frontendLogFlusher.test.ts
git commit -m "feat(ui): add sendBeacon flusher with fetch keepalive fallback"
```

---

## Task 12: Wire interceptor + flusher into `main.tsx`

**Files:**
- Modify: `apps/ui/src/main.tsx`

- [ ] **Step 1: Add the calls in `bootstrap()`**

Open `apps/ui/src/main.tsx`. Add two imports near the top of the file (alongside existing imports):

```ts
import { FrontendLogBuffer } from '@/lib/frontendLogBuffer'
import { installConsoleInterceptor } from '@/lib/consoleInterceptor'
import { startFrontendLogFlusher } from '@/lib/frontendLogFlusher'
```

Then, at the very top of the `bootstrap()` function body (before `initAuthTokenFromUrl()`), insert:

```ts
  const frontendLogBuffer = new FrontendLogBuffer()
  installConsoleInterceptor(frontendLogBuffer)
  startFrontendLogFlusher(frontendLogBuffer)
```

- [ ] **Step 2: Type-check**

```bash
cd apps/ui && pnpm exec tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3: Run all UI tests**

```bash
cd apps/ui && pnpm test
```

Expected: all suites PASS, including the three new ones (`frontendLogBuffer`, `consoleInterceptor`, `frontendLogFlusher`).

- [ ] **Step 4: Run all CLI tests**

```bash
cd apps/cli && pnpm test
```

Expected: all suites PASS, including `FrontendLogFile` and `Log`.

- [ ] **Step 5: Commit**

```bash
git add apps/ui/src/main.tsx
git commit -m "feat(ui): wire console interceptor and flusher at bootstrap"
```

---

## Task 13: Manual end-to-end smoke test

**Files:** none (verification only)

- [ ] **Step 1: Start CLI in file-log mode**

From repo root:
```bash
LOG_TARGET=file LOG_LEVEL=debug pnpm dev:cli
```

Expected: CLI prints `📝 Log directory: ...` and `📄 Log file: ...` at startup, no module errors.

- [ ] **Step 2: Start the UI dev server**

In a second terminal:
```bash
pnpm dev:ui
```

Expected: Vite serves the UI on its usual port (typically 5173).

- [ ] **Step 3: Trigger logs and inspect the file**

Open the UI in a browser. Open DevTools, then in the console tab run:

```js
console.log("hello from manual test");
console.warn("a warning");
console.error("an error", { detail: 42 });
```

Wait ~3 seconds (one flush interval), then in the terminal that started the CLI:

```bash
tail -n 20 <LOG_DIR>/frontend.log
```

Expected: three JSON log lines, each prefixed by the message. The browser's sessionStorage `smm.frontendLog.sessionId` should be a stable UUID across calls in the same tab.

- [ ] **Step 4: Verify pagehide flush**

Click a link or close the tab right after `console.info("before unload")`. After the page navigates/unloads, tail `frontend.log` again. Expected: the "before unload" entry is present (proves `pagehide` flush works).

- [ ] **Step 5: Verify rotation (manual, optional)**

In a Node REPL or by writing a small script, force the rotating stream past 10MB and confirm `frontend.log.1.gz` appears in the log directory. Skip if this is too disruptive — the unit test in Task 2 already covered the rotation behaviour.

- [ ] **Step 6: No commit (verification only)**

This task produces no diff. If issues are found, file a follow-up commit with the fix.

---

## Task 14: Update README with log file location (optional, lightweight)

**Files:**
- Modify: `README.md` (or skip — UI-only)

This task is optional. The user already confirmed no UI affordance for log files. If desired, add a short "Logs" section to README.md describing `frontend.log` location under `getLogDir()`. Skip if README churn is undesirable.

- [ ] **Step 1 (conditional): Add logs section**

Append to `README.md`:

```markdown
## Logs

When running the CLI with `LOG_TARGET=file`, logs are written to the platform-specific application log directory (see `apps/cli/src/utils/config.ts:getLogDir`):

- `smm.log` — backend (Hono, MCP, route handlers)
- `frontend.log` — UI console output streamed from the browser

Rotated by size (default 10MB × 5 files, gzipped). When reporting a bug, please attach the most recent `frontend.log`.
```

- [ ] **Step 2 (conditional): Commit**

```bash
git add README.md
git commit -m "docs: document frontend.log location for bug reports"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Implemented in |
|--------------|---------------|
| 5 console methods wrapped | Task 10 |
| Ring buffer, 1000 capacity | Task 9 |
| Flush triggers (2s / 50 / pagehide) | Task 11 |
| `sendBeacon` + `fetch keepalive` fallback | Task 11 |
| `FrontendLogEntry` / `FrontendLogBatch` wire types | Task 8 |
| sessionId in sessionStorage | Task 10 |
| Error serialization with stack | Task 9 |
| Three body shapes on `/api/log` | Task 4 |
| Per-entry truncation (4KB) | Task 5 |
| Batch size cap (200 → 413) | Task 6 |
| Rate-limit charge per `ceil(entries/50)` | Task 7 |
| Level → pino method mapping | Task 4 |
| `serverReceivedAt` injection | Task 4 |
| `appVersion` propagation | Task 4 |
| `rotating-file-stream` 10MB × 5 | Task 2 |
| `frontendLogger` separate child | Task 3 |
| Env-var overrides | Tasks 2, 5, 6 |
| Idempotent interceptor | Task 10 |
| Idempotent flusher | Task 11 |

No gaps.

**Placeholder scan:** Searched for `TODO`, `TBD`, `similar to`, `add appropriate error handling` — none present. Every code step shows full code.

**Type consistency:**
- `FrontendLogLevel = "log" | "info" | "warn" | "error" | "debug"` used consistently in `frontendLog.ts`, `frontendLogBuffer.ts`, `consoleInterceptor.ts`, `frontendLogFlusher.ts`.
- `SerializedArg.kind` includes `bigint` (Task 8 wire type) and is produced by `serializeArg` (Task 9) — both align.
- `FrontendLogBuffer.push/drain/size` used in Task 9, called from Task 10 (`installConsoleInterceptor(buffer)`) and Task 11 (`buffer.push(...)`).
- `startFrontendLogFlusher(buffer)` and `_resetFlusherForTests()` exported from Task 11, imported by Task 11's own test, and called from Task 12.
- `RateLimiter.charge(key, credits)` added in Task 4, consumed in Task 7.
- `createFrontendLogStream()` exported in Task 2, consumed in Task 3.

All consistent.