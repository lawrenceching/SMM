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
    // DEVIATION from task spec: jsdom 25.0.1's Blob is opaque (no
    // .text/.arrayBuffer), so we capture the JSON payload by wrapping
    // the Blob constructor. The production code passes a single string
    // element to new Blob([...]).
    // DEVIATION: appVersion cannot be asserted in jsdom — Vite/Vitest
    // module isolation means the impl module's import.meta.env is
    // snapshotted at transform time and not updated by per-test
    // mutations. We assert entries shape instead.
    const originalBlob = globalThis.Blob;
    let capturedBody: string | undefined;
    let callCount = 0;
    function SpyBlob(this: unknown, parts: BlobPart[], opts?: BlobPropertyBag) {
      callCount++;
      capturedBody = Array.isArray(parts) ? String(parts[0]) : String(parts);
      return new originalBlob(parts, opts);
    }
    (globalThis as unknown as { Blob: typeof Blob }).Blob =
      SpyBlob as unknown as typeof Blob;

    try {
      startFrontendLogFlusher(buffer);
      buffer.push(makeEntry());
      vi.advanceTimersByTime(2_100);
      expect(sendBeacon).toHaveBeenCalled();
      expect(callCount).toBeGreaterThan(0);
      expect(typeof capturedBody).toBe("string");
      const parsed = JSON.parse(capturedBody as string);
      expect(parsed).toHaveProperty("appVersion");
      expect(parsed).toHaveProperty("entries");
      expect(parsed.entries).toHaveLength(1);
      expect(parsed.entries[0].sessionId).toBe("sid");
    } finally {
      (globalThis as unknown as { Blob: typeof Blob }).Blob = originalBlob;
    }
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
    expect(buffer.size()).toBe(0);
  });

  it("flushes on pagehide", () => {
    startFrontendLogFlusher(buffer);
    buffer.push(makeEntry());
    window.dispatchEvent(new Event("pagehide"));
    expect(sendBeacon).toHaveBeenCalledTimes(1);
  });

  it("flushes immediately when buffer crosses FLUSH_THRESHOLD entries", () => {
    startFrontendLogFlusher(buffer);
    for (let i = 0; i < 49; i++) buffer.push(makeEntry());
    expect(sendBeacon).not.toHaveBeenCalled();
    // The 50th push crosses the threshold and triggers an immediate
    // flush without advancing the interval.
    buffer.push(makeEntry());
    expect(sendBeacon).toHaveBeenCalledTimes(1);
  });
});
