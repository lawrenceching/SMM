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
      vi.fn().mockResolvedValue({ ok: true, status: 200 }),
    );

    const result = await probeEndpointReachability(endpoint());
    expect(result.ok).toBe(true);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("returns ok=true even for 4xx/5xx responses (status is ignored)", async () => {
    // The probe intentionally treats any HTTP response as success.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401 }),
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

  it("attaches the Authorization Bearer header for date-token endpoints", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    await probeEndpointReachability(
      endpoint({ authorizationMethod: "date-token" }),
    );

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    // The probe sends the same Authorization header the search path
    // would send, so the upstream sees a well-formed request and
    // does not log the probe as an unauthenticated burst.
    expect(headers.Authorization).toMatch(/^Bearer \d{4}-\d{2}-\d{2}$/);
  });

  it("does not add Authorization header for 'none' endpoints", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    await probeEndpointReachability(endpoint({ authorizationMethod: "none" }));

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it("does not set an explicit mode (uses the default 'cors')", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    await probeEndpointReachability(endpoint());

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    // We rely on the fetch default (`cors`) so that the Authorization
    // header is actually sent. With `no-cors` the browser would strip
    // it, defeating the purpose of attaching it.
    expect(init.mode).toBeUndefined();
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
