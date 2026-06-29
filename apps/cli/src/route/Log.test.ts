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