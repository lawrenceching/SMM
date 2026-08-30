import { describe, expect, it } from "vitest";
import { getTmdbImageUrl } from "./tmdbImageUrl";

describe("getTmdbImageUrl", () => {
  it("returns null for missing or empty paths", () => {
    expect(getTmdbImageUrl(null)).toBeNull();
    expect(getTmdbImageUrl(undefined)).toBeNull();
    expect(getTmdbImageUrl("")).toBeNull();
    expect(getTmdbImageUrl("   ")).toBeNull();
  });

  it("returns absolute http(s) URLs unchanged", () => {
    expect(getTmdbImageUrl("https://example.com/poster.jpg")).toBe("https://example.com/poster.jpg");
    expect(getTmdbImageUrl("http://example.com/poster.jpg")).toBe("http://example.com/poster.jpg");
  });

  it("builds TMDB CDN URLs for relative paths", () => {
    expect(getTmdbImageUrl("/abc123.jpg", "w500")).toBe("https://image.tmdb.org/t/p/w500/abc123.jpg");
    expect(getTmdbImageUrl("/abc123.jpg", "original")).toBe(
      "https://image.tmdb.org/t/p/original/abc123.jpg",
    );
  });

  it("defaults to w500 and trims whitespace", () => {
    expect(getTmdbImageUrl("  /poster.jpg  ")).toBe("https://image.tmdb.org/t/p/w500/poster.jpg");
  });
});
