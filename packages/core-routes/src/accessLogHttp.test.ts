import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it } from "vitest";
import { attachHttpAccessLog, shouldLogHttpAccess } from "./accessLogHttp.ts";
import type { CoreRoutesLogger } from "./types.ts";

function makeCaptureLogger() {
  const calls: Array<{ level: string; obj: Record<string, unknown>; msg?: string }> = [];
  const logger: CoreRoutesLogger = {
    debug: (obj, msg) => calls.push({ level: "debug", obj, msg }),
    info: (obj, msg) => calls.push({ level: "info", obj, msg }),
    warn: (obj, msg) => calls.push({ level: "warn", obj, msg }),
    error: (obj, msg) => calls.push({ level: "error", obj, msg }),
  };
  return { calls, logger };
}

function makeMockReq(url: string, method = "GET"): IncomingMessage {
  return { url, method } as unknown as IncomingMessage;
}

function makeMockRes(statusCode = 200): ServerResponse {
  const res = new EventEmitter() as unknown as ServerResponse & EventEmitter;
  (res as { statusCode: number }).statusCode = statusCode;
  return res;
}

describe("shouldLogHttpAccess", () => {
  it("logs /api/ paths", () => {
    expect(shouldLogHttpAccess("/api/scrape")).toBe(true);
  });

  it("skips /api/log, static assets, socket.io and /proxy", () => {
    expect(shouldLogHttpAccess("/api/log")).toBe(false);
    expect(shouldLogHttpAccess("/index.html")).toBe(false);
    expect(shouldLogHttpAccess("/socket.io/")).toBe(false);
    expect(shouldLogHttpAccess("/proxy/api/chat")).toBe(false);
  });
});

describe("attachHttpAccessLog", () => {
  it("emits one ok info entry on finish", () => {
    const { calls, logger } = makeCaptureLogger();
    const req = makeMockReq("/api/scrape?id=7", "POST");
    const res = makeMockRes(200);
    attachHttpAccessLog(req, res, { logger });

    res.emit("finish");

    expect(calls).toHaveLength(1);
    expect(calls[0]?.level).toBe("info");
    expect(calls[0]?.obj).toMatchObject({
      source: "http",
      method: "POST",
      path: "/api/scrape",
      status: 200,
      outcome: "ok",
    });
    expect("query" in (calls[0]?.obj ?? {})).toBe(false);
    expect(typeof calls[0]?.obj.durationMs).toBe("number");
  });

  it("emits error entry for status >= 400", () => {
    const { calls, logger } = makeCaptureLogger();
    const res = makeMockRes(404);
    attachHttpAccessLog(makeMockReq("/api/media-metadata"), res, { logger });
    res.emit("finish");
    expect(calls[0]?.level).toBe("error");
    expect(calls[0]?.obj.outcome).toBe("error");
    expect(calls[0]?.obj.status).toBe(404);
  });

  it("emits aborted error entry on close before finish", () => {
    const { calls, logger } = makeCaptureLogger();
    const res = makeMockRes(200);
    attachHttpAccessLog(makeMockReq("/api/executeCmd", "POST"), res, { logger });

    res.emit("close");

    expect(calls).toHaveLength(1);
    expect(calls[0]?.level).toBe("error");
    expect(calls[0]?.obj).toMatchObject({ outcome: "error", aborted: true });
  });

  it("does not double-log when close fires after finish", () => {
    const { calls, logger } = makeCaptureLogger();
    const res = makeMockRes(200);
    attachHttpAccessLog(makeMockReq("/api/scrape"), res, { logger });
    res.emit("finish");
    res.emit("close");
    expect(calls).toHaveLength(1);
  });

  it("attaches raw query only when isDebugEnabled is true", () => {
    const { calls, logger } = makeCaptureLogger();
    const res = makeMockRes(200);
    attachHttpAccessLog(makeMockReq("/api/scrape?id=7&lang=zh"), res, {
      logger,
      isDebugEnabled: () => true,
    });
    res.emit("finish");
    expect(calls[0]?.obj.query).toBe("id=7&lang=zh");
  });

  it("skips non-API paths entirely", () => {
    const { calls, logger } = makeCaptureLogger();
    const res = makeMockRes(200);
    attachHttpAccessLog(makeMockReq("/assets/logo.png"), res, { logger });
    res.emit("finish");
    expect(calls).toHaveLength(0);
  });

  it("no-ops without a logger", () => {
    const res = makeMockRes(200);
    expect(() =>
      attachHttpAccessLog(makeMockReq("/api/scrape"), res, { logger: undefined }),
    ).not.toThrow();
  });
});
