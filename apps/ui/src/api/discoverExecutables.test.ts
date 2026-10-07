import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchDiscoverExecutables } from "./discoverExecutables";

describe("fetchDiscoverExecutables", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests via relative /api path so Vite proxy can attach auth", async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            ffmpeg: { configuredPath: null, discoveredPath: "/bin/ffmpeg/ffmpeg" },
            ytdlp: { configuredPath: null, discoveredPath: null },
            videocaptioner: { configuredPath: null, discoveredPath: null },
            quickjs: { configuredPath: null, discoveredPath: null },
          },
        }),
    });

    const result = await fetchDiscoverExecutables();

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/discoverExecutables");
    expect(result.ffmpeg.discoveredPath).toBe("/bin/ffmpeg/ffmpeg");
  });
});
