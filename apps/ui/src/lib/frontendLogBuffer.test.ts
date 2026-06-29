import { describe, it, expect, vi } from "vitest";
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

  it("subscriber fires on each push", () => {
    const b = new FrontendLogBuffer();
    const cb = vi.fn();
    b.subscribe(cb);
    b.push(entry({ ts: 1 }));
    b.push(entry({ ts: 2 }));
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it("subscribe returns an unsubscribe function", () => {
    const b = new FrontendLogBuffer();
    const cb = vi.fn();
    const unsub = b.subscribe(cb);
    b.push(entry({ ts: 1 }));
    unsub();
    b.push(entry({ ts: 2 }));
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
