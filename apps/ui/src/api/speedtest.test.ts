import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { speedtest } from "./speedtest";

describe("speedtest", () => {
  const mockUrls = [
    "https://github.com/lawrenceching/SMM/wiki/test",
    "https://gitcode.com/lawrenceching/simple-media-manager/test",
  ];

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the fastest URL from the API response", async () => {
    const mockResponse = {
      fastestUrl: mockUrls[1],
      results: [
        { url: mockUrls[0], timeMs: 1200 },
        { url: mockUrls[1], timeMs: 300 },
      ],
    };

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await speedtest(mockUrls);

    expect(result.fastestUrl).toBe(mockUrls[1]);
    expect(result.results).toHaveLength(2);
    expect(result.results[0].timeMs).toBe(1200);
    expect(result.results[1].timeMs).toBe(300);
  });

  it("throws on HTTP error response", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: () => Promise.resolve({ error: "urls must be an array" }),
    });

    await expect(speedtest(mockUrls)).rejects.toThrow("urls must be an array");
  });

  it("throws generic error when response body has no error field", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => Promise.resolve({}),
    });

    await expect(speedtest(mockUrls)).rejects.toThrow("HTTP 500 Internal Server Error");
  });

  it("sends POST request with correct body", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          fastestUrl: mockUrls[0],
          results: [
            { url: mockUrls[0], timeMs: 100 },
            { url: mockUrls[1], timeMs: 200 },
          ],
        }),
    });

    await speedtest(mockUrls);

    expect(globalThis.fetch).toHaveBeenCalledWith("/api/speedtest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: mockUrls }),
    });
  });
});
