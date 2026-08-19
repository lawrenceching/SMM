import { describe, expect, it } from "vitest";
import type { HttpResponse, NetworkPort } from "../ports/NetworkPort";
import { mapToTvdbLangCode, TvdbClient } from "./TvdbClient";

function jsonResponse(body: unknown): HttpResponse {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: {},
    text: () => Promise.resolve(JSON.stringify(body)),
    json: <T>() => Promise.resolve(body as T),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  };
}

function envelope(data: unknown) {
  return { status: "success", data };
}

function tvdbNetwork(searchUrls: string[] = []): NetworkPort {
  return {
    fetch: async (url) => {
      if (url.includes("/search")) {
        searchUrls.push(url);
        const type = url.includes("type=series") ? "series" : "movie";
        return jsonResponse(
          envelope(
            type === "series"
              ? [{ id: "series-1", objectID: "series-1", name: "My Show", tvdb_id: "1" }]
              : [{ id: "movie-2", objectID: "movie-2", name: "My Film", tvdb_id: "2" }],
          ),
        );
      }
      if (url.includes("/series/1/translations/eng")) {
        return jsonResponse(envelope({ name: "My Show" }));
      }
      if (url.includes("/series/1/extended")) {
        return jsonResponse(
          envelope({
            id: 1,
            name: "My Show",
            firstAired: "2020-01-01",
            seasons: [{ id: 11, number: 1, type: { name: "Aired Order" } }],
          }),
        );
      }
      if (url.includes("/seasons/11/extended")) {
        return jsonResponse(
          envelope({
            id: 11,
            episodes: [{ id: 1, number: 1, seasonNumber: 1, name: "Pilot" }],
          }),
        );
      }
      if (url.includes("/movies/2/translations/eng")) {
        return jsonResponse(envelope({ name: "My Film" }));
      }
      if (url.includes("/movies/2/extended")) {
        return jsonResponse(envelope({ id: 2, name: "My Film", first_release: { first: "2019-05-01" } }));
      }
      throw new Error("unexpected url: " + url);
    },
  };
}

describe("TvdbClient", () => {
  it("searches series", async () => {
    const client = new TvdbClient(tvdbNetwork(), {});
    const items = await client.searchSeries("My Show", "en-US");
    expect(items?.[0]?.tvdb_id).toBe("1");
  });

  it("searches movies", async () => {
    const client = new TvdbClient(tvdbNetwork(), {});
    const items = await client.searchMovie("My Film", "en-US");
    expect(items?.[0]?.tvdb_id).toBe("2");
  });

  it("maps the preferred language to TVDB ISO 639-3 in search", async () => {
    const searchUrls: string[] = [];
    const client = new TvdbClient(tvdbNetwork(searchUrls), {});
    await client.searchSeries("My Show", "en-US");
    await client.searchMovie("My Film", "ja-JP");
    await client.searchSeries("My Show", "zh-CN");
    expect(searchUrls[0]).toContain("language=eng");
    expect(searchUrls[1]).toContain("language=jpn");
    expect(searchUrls[2]).toContain("language=zho");
  });

  it("getTvShowMediaMetadata builds seasons + episodes", async () => {
    const client = new TvdbClient(tvdbNetwork(), {});
    const tvShow = await client.getTvShowMediaMetadata(1, "en-US");
    expect(tvShow).toEqual({
      id: "1",
      name: "My Show",
      database: "TVDB",
      airDate: "2020-01-01",
      seasons: [
        { season: 1, name: "", episodes: [{ season: 1, episode: 1, name: "Pilot" }] },
      ],
    });
  });

  it("getMovieMediaMetadata maps a movie", async () => {
    const client = new TvdbClient(tvdbNetwork(), {});
    const movie = await client.getMovieMediaMetadata(2, "en-US");
    expect(movie).toEqual({ id: "2", name: "My Film", airDate: "2019-05-01", database: "TVDB" });
  });

  it("maps IETF media language to TVDB ISO 639-3", () => {
    expect(mapToTvdbLangCode("zh-CN")).toBe("zho");
    expect(mapToTvdbLangCode("en-US")).toBe("eng");
    expect(mapToTvdbLangCode("ja-JP")).toBe("jpn");
  });
});
