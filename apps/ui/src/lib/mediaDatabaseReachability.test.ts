import { afterEach, describe, expect, it, vi } from "vitest";
import {
  pickFastestEndpoint,
  probeEndpointReachability,
} from "./mediaDatabaseReachability";
import { todayDateToken } from "./mediaDatabaseDateToken";
import type { MediaDatabaseEndpoint } from "@/api/discover";

const endpoint = (overrides: Partial<MediaDatabaseEndpoint> = {}): MediaDatabaseEndpoint => ({
  type: "tmdb",
  url: "https://example.com/api/tmdb",
  authorizationMethod: "none",
  ...overrides,
});

describe("todayDateToken", () => {
  it("formats today as yyyy-MM-dd in local timezone", () => {
    const result = todayDateToken(new Date(2024, 4, 7));
    expect(result).toBe("2024-05-07");
  });
});

describe("probeEndpointReachability", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ok=true with duration when fetch resolves", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 0, type: "opaque" }),
    );

    const result = await probeEndpointReachability(endpoint());
    expect(result.ok).toBe(true);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("returns ok=true even for non-ok status (opaque response)", async () => {
    // In no-cors mode, the response is opaque and status is not visible.
    // We treat any non-erroring fetch as success.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, type: "opaque" }),
    );

    const result = await probeEndpointReachability(endpoint());
    expect(result.ok).toBe(true);
  });

  it("returns ok=false with error message when fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );

    const result = await probeEndpointReachability(endpoint());
    expect(result.ok).toBe(false);
    expect(result.error).toBe("network down");
  });

  it("does not attach an Authorization header (no-cors strips it anyway)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, type: "opaque" });
    vi.stubGlobal("fetch", fetchMock);

    await probeEndpointReachability(
      endpoint({ authorizationMethod: "date-token" }),
    );

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    // The reachability probe uses no-cors mode, which strips the
    // Authorization header in the browser. The token-aware search path
    // is a separate code path that uses cors mode.
    expect(headers.Authorization).toBeUndefined();
  });

  it("does not add Authorization header for 'none' endpoints", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, type: "opaque" });
    vi.stubGlobal("fetch", fetchMock);

    await probeEndpointReachability(endpoint({ authorizationMethod: "none" }));

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it("uses mode: 'no-cors'", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, type: "opaque" });
    vi.stubGlobal("fetch", fetchMock);

    await probeEndpointReachability(endpoint());

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.mode).toBe("no-cors");
  });
});

describe("pickFastestEndpoint", () => {
  const e = (url: string, ms: number, ok = true) => ({
    endpoint: endpoint({ url }),
    ok,
    durationMs: ms,
  });

  it("returns the endpoint with the lowest duration among successful results", () => {
    const fastest = pickFastestEndpoint([
      e("https://a.com", 300),
      e("https://b.com", 100),
      e("https://c.com", 200),
    ]);
    expect(fastest?.url).toBe("https://b.com");
  });

  it("ignores failed endpoints", () => {
    const fastest = pickFastestEndpoint([
      e("https://a.com", 50, false),
      e("https://b.com", 200),
    ]);
    expect(fastest?.url).toBe("https://b.com");
  });

  it("returns null when no endpoint succeeded", () => {
    const fastest = pickFastestEndpoint([
      e("https://a.com", 50, false),
      e("https://b.com", 100, false),
    ]);
    expect(fastest).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(pickFastestEndpoint([])).toBeNull();
  });
});
