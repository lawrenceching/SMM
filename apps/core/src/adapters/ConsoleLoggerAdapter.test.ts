import { describe, expect, it, vi } from "vitest";
import { ConsoleLoggerAdapter, NoopLoggerAdapter } from "./ConsoleLoggerAdapter";

describe("ConsoleLoggerAdapter", () => {
  it("forwards to console", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const adapter = new ConsoleLoggerAdapter();
    adapter.warn({ a: 1 }, "msg");
    expect(spy).toHaveBeenCalledWith("msg", { a: 1 });
    spy.mockRestore();
  });
});

describe("NoopLoggerAdapter", () => {
  it("does nothing without throwing", () => {
    const adapter = new NoopLoggerAdapter();
    expect(() => adapter.info({}, "x")).not.toThrow();
    expect(() => adapter.error({}, "x")).not.toThrow();
  });
});
