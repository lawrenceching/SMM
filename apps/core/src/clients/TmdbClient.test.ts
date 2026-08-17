import { describe, expect, it } from "vitest";
import type { HttpResponse, NetworkPort } from "../ports/NetworkPort";
import { buildTvShowMediaMetadata, TmdbClient } from "./TmdbClient";

function jsonResponse(body: unknown): HttpResponse {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: {},
    text: () => Promise.resolve(JSON.stringify(body)),
    json: <T>() => Promise.resolve(body as T),
  };
}

function networkMock(routes: Record<string, unknown>): {
  network: NetworkPort;
  urls: string[];
  headers: Record<string, string | undefined>[];
} {
  const urls: string[] = [];
  const headers: Record<string, string | undefined>[] = [];
  const network: NetworkPort = {
    fetch: async (url, init) => {
      urls.push(url);
      headers.push(init?.headers ?? {});
      const found = Object.entries(routes).find(([pattern]) => url.includes(pattern));
      if (found === undefined) throw new Error("unexpected url: " + url);
      return jsonResponse(found[1]);
    },
  };
  return { network, urls, headers };
}

describe("TmdbClient", () => {
  it("search sends query/language and Authorization header", async () => {
    const { network, urls, headers } = networkMock({ "/search/tv" : { results: [{ id: 1, name: "S" }], page: 1, total_pages: 1, total_results: 1 } });
    const client = new TmdbClient(network, { host: "https://tmdb.example", apiKey: "abc" });

    const body = await client.search("My Show", "tv", "en-US");

    expect(body.results[0]?.id).toBe(1);
    const url = urls[0]!;
    expect(url).toContain("https://tmdb.example/search/tv");
    expect(url).toContain("query=My%20Show");
    expect(url).toContain("language=en-US");
    expect(headers[0]?.Authorization).toBe("Bearer abc");
  });

  it("getTvShowMediaMetadata fetches series + each season and builds TvShowMediaMetadata", async () => {
    const series = {
      id: 1,
      name: "My Show",
      first_air_date: "2020-01-01",
      seasons: [
        { id: 11, name: "Season 1", season_number: 1, air_date: "2020-01-01", episode_count: 1 },
      ],
    };
    const season = {
      id: 11,
      name: "Season 1",
      season_number: 1,
      air_date: "2020-01-01",
      episode_count: 1,
      episodes: [
        { id: 1, name: "Pilot", episode_number: 1, season_number: 1, air_date: "2020-01-01", overview: "", still_path: null, vote_average: 0, vote_count: 0, runtime: 45 },
      ],
    };
    const { network, urls } = networkMock({
      "/tv/1?": series,
      "/tv/1/season/1?": season,
    });
    const client = new TmdbClient(network, {});

    const tvShow = await client.getTvShowMediaMetadata(1, "en-US");

    expect(tvShow).toEqual({
      id: "1",
      name: "My Show",
      database: "TMDB",
      airDate: "2020-01-01",
      seasons: [
        { season: 1, name: "Season 1", episodes: [{ season: 1, episode: 1, name: "Pilot" }] },
      ],
    });
    expect(urls[0]).toContain("/tv/1?");
    expect(urls[1]).toContain("/tv/1/season/1?");
  });

  it("getMovieMediaMetadata maps a movie detail", async () => {
    const movie = { id: 2, title: "My Film", release_date: "2019-05-01" };
    const { network } = networkMock({ "/movie/2?" : movie });
    const client = new TmdbClient(network, {});

    const mm = await client.getMovieMediaMetadata(2, "en-US");

    expect(mm).toEqual({ id: "2", name: "My Film", airDate: "2019-05-01", database: "TMDB" });
  });

  it("buildTvShowMediaMetadata maps series + season details to TvShowMediaMetadata", () => {
    const result = buildTvShowMediaMetadata(
      { id: 5, name: "S", first_air_date: "2020-01-01", seasons: [{ season_number: 1, name: "S1" }] } as never,
      [{ season_number: 1, name: "S1", episodes: [{ episode_number: 1, season_number: 1, name: "E1" }] }] as never,
    );
    expect(result.seasons).toEqual([{ season: 1, name: "S1", episodes: [{ season: 1, episode: 1, name: "E1" }] }]);
  });
});
