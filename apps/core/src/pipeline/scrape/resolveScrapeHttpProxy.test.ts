import { describe, expect, it } from "vitest";
import type { MediaMetadata, UserConfig } from "@smm/core";
import { DEFAULT_USER_CONFIG } from "../userConfigHelper";
import {
  resolveMediaDatabaseHttpProxy,
  resolveScrapeHttpProxy,
} from "./resolveScrapeHttpProxy";

function buildUserConfig(
  overrides: { tmdb?: UserConfig["tmdb"]; tvdb?: UserConfig["tvdb"] } = {},
): UserConfig {
  return {
    ...DEFAULT_USER_CONFIG,
    tmdb: { ...DEFAULT_USER_CONFIG.tmdb, ...overrides.tmdb },
    tvdb: { ...DEFAULT_USER_CONFIG.tvdb, ...overrides.tvdb },
  };
}

describe("resolveMediaDatabaseHttpProxy", () => {
  it("returns tmdb httpProxy when custom tmdb host + proxy configured", () => {
    const uc = buildUserConfig({
      tmdb: { host: "https://api.themoviedb.org", httpProxy: "http://proxy:8080" },
    });
    expect(resolveMediaDatabaseHttpProxy("TMDB", uc)).toBe("http://proxy:8080");
  });

  it("returns tvdb httpProxy when custom tvdb host + proxy configured", () => {
    const uc = buildUserConfig({
      tvdb: { host: "https://api4.thetvdb.com", httpProxy: "http://proxy:9090" },
    });
    expect(resolveMediaDatabaseHttpProxy("TVDB", uc)).toBe("http://proxy:9090");
  });

  it("returns undefined when host is empty", () => {
    const uc = buildUserConfig({ tmdb: { host: "", httpProxy: "http://proxy:8080" } });
    expect(resolveMediaDatabaseHttpProxy("TMDB", uc)).toBeUndefined();
  });

  it("returns undefined when host is not a parseable URL", () => {
    const uc = buildUserConfig({ tmdb: { host: "not a url", httpProxy: "http://proxy:8080" } });
    expect(resolveMediaDatabaseHttpProxy("TMDB", uc)).toBeUndefined();
  });

  it("returns undefined when httpProxy is blank", () => {
    const uc = buildUserConfig({
      tmdb: { host: "https://api.themoviedb.org", httpProxy: "   " },
    });
    expect(resolveMediaDatabaseHttpProxy("TMDB", uc)).toBeUndefined();
  });

  it("trims surrounding whitespace from httpProxy", () => {
    const uc = buildUserConfig({
      tmdb: { host: "https://api.themoviedb.org", httpProxy: "  http://proxy:8080  " },
    });
    expect(resolveMediaDatabaseHttpProxy("TMDB", uc)).toBe("http://proxy:8080");
  });
});

describe("resolveScrapeHttpProxy", () => {
  it("resolves the proxy from the tvshow database", () => {
    const uc = buildUserConfig({
      tvdb: { host: "https://api4.thetvdb.com", httpProxy: "http://proxy:9090" },
    });
    const md = {
      type: "tvshow-folder",
      tvShow: { id: "1", database: "TVDB", name: "T", seasons: [] },
    } as MediaMetadata;
    expect(resolveScrapeHttpProxy(md, uc)).toBe("http://proxy:9090");
  });

  it("resolves the proxy from the movie database", () => {
    const uc = buildUserConfig({
      tmdb: { host: "https://api.themoviedb.org", httpProxy: "http://proxy:8080" },
    });
    const md = {
      type: "movie-folder",
      movie: { id: "1", database: "TMDB", name: "M" },
    } as MediaMetadata;
    expect(resolveScrapeHttpProxy(md, uc)).toBe("http://proxy:8080");
  });

  it("returns undefined for music folders", () => {
    const uc = buildUserConfig({
      tmdb: { host: "https://api.themoviedb.org", httpProxy: "http://proxy:8080" },
    });
    const md = { type: "music-folder" } as MediaMetadata;
    expect(resolveScrapeHttpProxy(md, uc)).toBeUndefined();
  });

  it("returns undefined when the database is missing", () => {
    const uc = buildUserConfig({
      tmdb: { host: "https://api.themoviedb.org", httpProxy: "http://proxy:8080" },
    });
    const md = { type: "movie-folder", movie: { id: "1", name: "M" } } as MediaMetadata;
    expect(resolveScrapeHttpProxy(md, uc)).toBeUndefined();
  });
});
