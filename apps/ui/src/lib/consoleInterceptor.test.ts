import { describe, it, expect, beforeEach, vi } from "vitest";
import { installConsoleInterceptor, _uninstallConsoleInterceptor } from "./consoleInterceptor";
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
    _uninstallConsoleInterceptor();
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
