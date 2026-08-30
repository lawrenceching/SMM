import { describe, expect, it } from "vitest";
import { buildAssetUrlCandidates } from "./assetImageUrls";
import type { DiscoverConfig } from "../../ports/DiscoverPort";

const emptyConfig: DiscoverConfig = { mediaDatabases: [], reverseProxies: [] };

const configWithAssets: DiscoverConfig = {
  mediaDatabases: [
    { type: "tmdb", url: "https://api.example/tmdb", authorizationMethod: "none" },
    { type: "tmdb-asset", url: "https://tmdb-mirror.example", authorizationMethod: "none" },
    { type: "tmdb-asset", url: "https://tmdb-mirror-2.example/", authorizationMethod: "none" },
    { type: "tvdb-asset", url: "https://tvdb-mirror.example", authorizationMethod: "none" },
  ],
  reverseProxies: [],
};

describe("buildAssetUrlCandidates", () => {
  it("puts official TMDB URL first, then host-swapped tmdb-asset mirrors", () => {
    const url = "https://image.tmdb.org/t/p/original/poster.jpg";
    expect(buildAssetUrlCandidates(url, configWithAssets)).toEqual([
      "https://image.tmdb.org/t/p/original/poster.jpg",
      "https://tmdb-mirror.example/t/p/original/poster.jpg",
      "https://tmdb-mirror-2.example/t/p/original/poster.jpg",
    ]);
  });

  it("puts official TVDB artwork URL first, then tvdb-asset mirrors", () => {
    const url = "https://artworks.thetvdb.com/banners/v4/series/1/posters/abc.jpg";
    expect(buildAssetUrlCandidates(url, configWithAssets)).toEqual([
      "https://artworks.thetvdb.com/banners/v4/series/1/posters/abc.jpg",
      "https://tvdb-mirror.example/banners/v4/series/1/posters/abc.jpg",
    ]);
  });

  it("normalizes protocol-relative URLs before building candidates", () => {
    const url = "//image.tmdb.org/t/p/w500/a.jpg";
    expect(buildAssetUrlCandidates(url, configWithAssets)[0]).toBe(
      "https://image.tmdb.org/t/p/w500/a.jpg",
    );
  });

  it("returns only the original URL for unknown hosts", () => {
    expect(
      buildAssetUrlCandidates("https://cdn.example.com/pic.jpg", configWithAssets),
    ).toEqual(["https://cdn.example.com/pic.jpg"]);
  });

  it("returns only the original URL when discover has no matching assets", () => {
    expect(
      buildAssetUrlCandidates("https://image.tmdb.org/t/p/original/x.jpg", emptyConfig),
    ).toEqual(["https://image.tmdb.org/t/p/original/x.jpg"]);
  });

  it("dedupes when a mirror origin matches the original host", () => {
    const config: DiscoverConfig = {
      mediaDatabases: [
        {
          type: "tmdb-asset",
          url: "https://image.tmdb.org",
          authorizationMethod: "none",
        },
      ],
      reverseProxies: [],
    };
    expect(
      buildAssetUrlCandidates("https://image.tmdb.org/t/p/original/x.jpg", config),
    ).toEqual(["https://image.tmdb.org/t/p/original/x.jpg"]);
  });

  it("skips invalid asset base URLs", () => {
    const config: DiscoverConfig = {
      mediaDatabases: [
        { type: "tmdb-asset", url: "not a url", authorizationMethod: "none" },
        { type: "tmdb-asset", url: "https://good.example", authorizationMethod: "none" },
      ],
      reverseProxies: [],
    };
    expect(
      buildAssetUrlCandidates("https://image.tmdb.org/t/p/original/x.jpg", config),
    ).toEqual([
      "https://image.tmdb.org/t/p/original/x.jpg",
      "https://good.example/t/p/original/x.jpg",
    ]);
  });

  it("replaces the first TMDB CDN host when overrideDefaultTmdbAssetServerHost is set", () => {
    const url = "https://image.tmdb.org/t/p/original/poster.jpg";
    expect(
      buildAssetUrlCandidates(url, configWithAssets, {
        overrideDefaultTmdbAssetServerHost: "wronghost.tmdb.local",
      }),
    ).toEqual([
      "https://wronghost.tmdb.local/t/p/original/poster.jpg",
      "https://tmdb-mirror.example/t/p/original/poster.jpg",
      "https://tmdb-mirror-2.example/t/p/original/poster.jpg",
    ]);
  });

  it("ignores override for non-TMDB asset hosts", () => {
    const url = "https://artworks.thetvdb.com/banners/v4/series/1/posters/abc.jpg";
    expect(
      buildAssetUrlCandidates(url, configWithAssets, {
        overrideDefaultTmdbAssetServerHost: "wronghost.tmdb.local",
      }),
    ).toEqual([
      "https://artworks.thetvdb.com/banners/v4/series/1/posters/abc.jpg",
      "https://tvdb-mirror.example/banners/v4/series/1/posters/abc.jpg",
    ]);
  });
});
