import { describe, expect, it } from "vitest";
import { StaticDiscoverAdapter } from "./StaticDiscoverAdapter";

describe("StaticDiscoverAdapter", () => {
  it("returns bundled TMDB and TVDB hosts including non-mediadb mirrors", async () => {
    const discover = new StaticDiscoverAdapter();
    const config = await discover.getDiscoverConfig();

    const tmdb = config.mediaDatabases.filter((e) => e.type === "tmdb").map((e) => e.url);
    const tvdb = config.mediaDatabases.filter((e) => e.type === "tvdb").map((e) => e.url);

    expect(tmdb).toContain("https://mediadb.vercel.app/api/tmdb");
    expect(tmdb.some((u) => u.includes("tencentscf.com"))).toBe(true);
    expect(tvdb).toContain("https://mediadb.vercel.app/api/tvdb");
    expect(tvdb.some((u) => u.includes("tencentscf.com"))).toBe(true);
  });
});
