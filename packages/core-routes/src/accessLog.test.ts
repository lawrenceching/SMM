import { describe, expect, it } from "vitest";
import { logAccess, serializeErrorForLog, truncateForLog } from "./accessLog.ts";
import type { AccessEntry, AccessSource } from "./accessLog.ts";
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

function makeEntry(overrides: Partial<AccessEntry> & { source: AccessSource }): AccessEntry {
  return { outcome: "ok", ...overrides };
}

describe("logAccess", () => {
  it("emits ok entries at info level with msg 'access'", () => {
    const { calls, logger } = makeCaptureLogger();
    logAccess(logger, makeEntry({ source: "mcp", tool: "get-job", durationMs: 12 }));
    expect(calls).toHaveLength(1);
    expect(calls[0]?.level).toBe("info");
    expect(calls[0]?.msg).toBe("access");
    expect(calls[0]?.obj).toMatchObject({ source: "mcp", tool: "get-job", outcome: "ok", durationMs: 12 });
  });

  it("emits error outcomes at error level", () => {
    const { calls, logger } = makeCaptureLogger();
    logAccess(logger, makeEntry({ source: "http", outcome: "error", status: 404 }));
    expect(calls[0]?.level).toBe("error");
  });

  it("emits socket.io broadcast entries at debug level even when outcome is ok", () => {
    const { calls, logger } = makeCaptureLogger();
    logAccess(logger, makeEntry({ source: "socket.io", kind: "broadcast", event: "ping" }));
    expect(calls[0]?.level).toBe("debug");
  });

  it("no-ops silently when logger is undefined", () => {
    expect(() =>
      logAccess(undefined, makeEntry({ source: "mcp", outcome: "error" })),
    ).not.toThrow();
  });

  it("never throws even when the logger itself throws", () => {
    const throwing: CoreRoutesLogger = {
      debug: () => { throw new Error("logger broke"); },
      info: () => { throw new Error("logger broke"); },
      warn: () => { throw new Error("logger broke"); },
      error: () => { throw new Error("logger broke"); },
    };
    expect(() =>
      logAccess(throwing, makeEntry({ source: "mcp", outcome: "error" })),
    ).not.toThrow();
  });
});

describe("truncateForLog", () => {
  it("passes small values through unchanged (same reference)", () => {
    const value = { id: "j-1" };
    expect(truncateForLog(value)).toBe(value);
  });

  it("degrades oversized values to { truncated, preview }", () => {
    const big = { blob: "x".repeat(3000) };
    const result = truncateForLog(big) as { truncated: boolean; preview: string };
    expect(result.truncated).toBe(true);
    expect(result.preview).toHaveLength(2000);
  });

  it("returns '[unserializable]' for cyclic values instead of throwing", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(truncateForLog(cyclic)).toBe("[unserializable]");
  });

  it("respects a custom budget", () => {
    const value = { blob: "x".repeat(100) };
    const result = truncateForLog(value, 10) as { truncated: boolean; preview: string };
    expect(result.truncated).toBe(true);
    expect(result.preview).toHaveLength(10);
  });
});

describe("serializeErrorForLog", () => {
  it("serializes Error to { message, name, stack }", () => {
    const error = new Error("boom");
    const result = serializeErrorForLog(error);
    expect(result.message).toBe("boom");
    expect(result.name).toBe("Error");
    expect(typeof result.stack).toBe("string");
  });

  it("serializes non-Error to { value }", () => {
    expect(serializeErrorForLog("plain failure")).toEqual({ value: "plain failure" });
  });
});
