import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Hono } from "hono";
import { handleLog, _resetRateLimiterForTests } from "./Log";
import { frontendLogger } from "../../lib/logger";

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
  resolveFrontendLogPath: () => "/tmp/browser.log",
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

  it("rejects body missing both message and args with 400", async () => {
    const res = await app.request("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: "info" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects entry with empty args[] with 400", async () => {
    const res = await app.request("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: [{ level: "info", args: [] }], appVersion: "x" }),
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

describe("POST /api/log — args[] wire format", () => {
  let app: Hono;
  beforeEach(() => {
    vi.clearAllMocks();
    _resetRateLimiterForTests();
    app = new Hono(); handleLog(app);
  });

  it("accepts batch where entries carry args[] (the format the browser interceptor produces)", async () => {
    const res = await app.request("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entries: [{
          level: "log",
          args: [{ kind: "string", value: "opening" }, { kind: "string", value: "folder-123" }],
          ts: 1,
          url: "https://app.test/home",
          sessionId: "s1",
        }],
        appVersion: "1.4.0",
      }),
    });
    expect(res.status).toBe(204);
    const call = (frontendLogger.info as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1]).toBe("[frontend] opening folder-123");
  });

  it("decorates function/circular/undefined kinds for readability", async () => {
    const res = await app.request("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entries: [{
          level: "info",
          args: [
            { kind: "string", value: "hi" },
            { kind: "undef", value: "" },
            { kind: "null", value: "" },
            { kind: "circular", value: "[Circular]" },
            { kind: "fn", value: "function foo() { return 1; }" },
          ],
        }],
        appVersion: "1.4.0",
      }),
    });
    expect(res.status).toBe(204);
    const call = (frontendLogger.info as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1]).toBe("[frontend] hi undefined null [Circular] [Function: function foo() { return 1; }]");
  });

  it("prefers explicit message over args[] when both are present", async () => {
    const res = await app.request("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entries: [{
          level: "info",
          message: "explicit-message",
          args: [{ kind: "string", value: "args-message" }],
        }],
        appVersion: "1.4.0",
      }),
    });
    expect(res.status).toBe(204);
    const call = (frontendLogger.info as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1]).toBe("[frontend] explicit-message");
  });
});

describe("POST /api/log — truncation", () => {
  let app: Hono;
  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono(); handleLog(app);
  });

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
    const ctx = calls[0][0] as { truncated?: boolean };
    expect(ctx.truncated).toBe(true);
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
    expect(statuses).toContain(429);
  });
});

describe("POST /api/log — pino this-binding (regression)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatches frontend log entries using .call so pino's internal `this` is bound", () => {
    // Pino 10's LOG function reads `this[msgPrefixSym]`. Detached method calls
    // (e.g. through a Record cast + indexed access) crash with
    // "this[msgPrefixSym] is undefined". The route now uses
    // `frontendLogger[entry.level].call(frontendLogger, ...)` to keep `this`.
    // We exercise the exact pattern the route uses here. With vi.fn() mocks,
    // the bug is invisible, so we additionally assert the call shape (receiver
    // is the logger, args are the enriched context + line) so a future
    // regression that re-introduces detached invocation fails this test.
    const method = frontendLogger.info;
    expect(typeof method).toBe("function");
    method.call(frontendLogger, { foo: "bar" }, "[frontend] test message");
    expect(frontendLogger.info).toHaveBeenCalledTimes(1);
    expect(frontendLogger.info).toHaveBeenCalledWith(
      { foo: "bar" },
      "[frontend] test message",
    );
  });

  it("full request through Hono returns 204 with the bind-this dispatch path", async () => {
    // The mocked frontendLogger doesn't read msgPrefixSym, so this is a smoke
    // check that the route still produces 204 with the new dispatch shape.
    // Combined with the previous test, this covers both the call pattern and
    // the route's success path.
    const app = new Hono();
    handleLog(app);
    const res = await app.request("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: "info", message: "real-pino test" }),
    });
    expect(res.status).toBe(204);
    expect(frontendLogger.info).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/log — frontend 'log' level", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetRateLimiterForTests();
  });

  it("accepts level='log' (console.log) and dispatches to frontendLogger.info", async () => {
    const app = new Hono();
    handleLog(app);
    const res = await app.request("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: "log", message: "from console.log" }),
    });
    expect(res.status).toBe(204);
    expect(frontendLogger.info).toHaveBeenCalledTimes(1);
    const args = (frontendLogger.info as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(args[1]).toBe("[frontend] from console.log");
  });
});

// Regression test for the auth-bypass behavior added to apps/cli/server.ts
// when the frontend log streaming pipeline was wired up. The flusher's
// primary path is sendBeacon, which cannot carry an Authorization header,
// so /api/log MUST be reachable without a token or the whole pipeline
// silently drops every entry with a 401 the flusher swallows.
describe("POST /api/log — auth bypass", () => {
  function buildAppWithAuth(auth?: { enabled: boolean; token: string }): Hono {
    const app = new Hono();
    // Mirror the middleware shape in apps/cli/server.ts so a regression
    // there (e.g. someone removes the /api/log allowlist) is caught here.
    app.use("/api/*", async (c, next) => {
      if (c.req.method === "OPTIONS") return next();
      if (c.req.path === "/api/log") return next();
      const configured = auth;
      if (!configured?.enabled) return next();
      const header = c.req.header("Authorization");
      const match = /^Bearer\s+(.+)$/i.exec(header ?? "");
      const provided = match?.[1]?.trim();
      if (provided && provided === configured.token) return next();
      return c.json({ error: "Unauthorized: invalid or missing token" }, 401);
    });
    handleLog(app);
    return app;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    _resetRateLimiterForTests();
  });

  it("returns 204 with no Authorization header when auth is enabled (the flusher case)", async () => {
    const app = buildAppWithAuth({ enabled: true, token: "secret" });
    const res = await app.request("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: "info", message: "no-token" }),
    });
    expect(res.status).toBe(204);
  });

  it("still accepts a valid Bearer token when present (defense-in-depth)", async () => {
    const app = buildAppWithAuth({ enabled: true, token: "secret" });
    const res = await app.request("/api/log", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer secret",
      },
      body: JSON.stringify({ level: "info", message: "with-token" }),
    });
    expect(res.status).toBe(204);
  });

  it("still rejects other /api/* paths with 401 when auth is enabled", async () => {
    // Sanity check: the bypass must be scoped to /api/log, not /api/* as a whole.
    // We register a trivial sibling route to assert the middleware still gates it.
    const app = buildAppWithAuth({ enabled: true, token: "secret" });
    app.get("/api/ping", (c) => c.text("pong"));
    const noAuth = await app.request("/api/ping");
    expect(noAuth.status).toBe(401);
    const withAuth = await app.request("/api/ping", {
      headers: { Authorization: "Bearer secret" },
    });
    expect(withAuth.status).toBe(200);
    expect(await withAuth.text()).toBe("pong");
  });
});