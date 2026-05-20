import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchConvexSettings, getConvexSiteUrl } from "./convexSettings";

describe("getConvexSiteUrl", () => {
  it("returns trimmed site URL from env", () => {
    vi.stubEnv("VITE_CONVEX_SITE_URL", "https://example.convex.site");
    expect(getConvexSiteUrl()).toBe("https://example.convex.site");
  });
});

describe("fetchConvexSettings", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_CONVEX_SITE_URL", "https://example.convex.site");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("fetches and parses latestVersion", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ latestVersion: "1.2.5" }),
      }),
    );

    const settings = await fetchConvexSettings();
    expect(settings).toEqual({ latestVersion: "1.2.5" });
    expect(fetch).toHaveBeenCalledWith("https://example.convex.site/api/settings");
  });

  it("throws when response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );

    await expect(fetchConvexSettings()).rejects.toThrow(
      "Convex settings request failed: 500",
    );
  });

  it("returns empty object when site URL is not configured", async () => {
    vi.stubEnv("VITE_CONVEX_SITE_URL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const settings = await fetchConvexSettings();
    expect(settings).toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
