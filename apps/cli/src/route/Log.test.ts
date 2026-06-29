import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Hono } from "hono";
import { handleLog } from "./Log";
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