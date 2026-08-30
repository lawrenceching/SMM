import { describe, expect, it } from "vitest";
import { parseNfo } from "./nfo";

describe("parseNfo", () => {
  it("extracts title, tmdbid and tvdbid from a tvshow.nfo", () => {
    const xml = "<tvshow><title>My Show</title><tmdbid>123</tmdbid><tvdbid>456</tvdbid></tvshow>";
    expect(parseNfo(xml)).toEqual({ title: "My Show", tmdbid: "123", tvdbid: "456" });
  });

  it("extracts ids from a movie.nfo", () => {
    const xml = "<movie><title>My Film</title><tmdbid>7</tmdbid></movie>";
    expect(parseNfo(xml)).toEqual({ title: "My Film", tmdbid: "7", tvdbid: undefined });
  });

  it("handles self-closing and missing fields", () => {
    expect(parseNfo("<tvshow><tmdbid>5</tmdbid></tvshow>")).toEqual({
      title: undefined,
      tmdbid: "5",
      tvdbid: undefined,
    });
    expect(parseNfo("<tvshow/>")).toEqual({ title: undefined, tmdbid: undefined, tvdbid: undefined });
  });
});
