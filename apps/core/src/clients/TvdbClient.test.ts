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
    const items = await client.searchSeries("My Show", "eng");
    expect(items?.[0]?.tvdb_id).toBe("1");
  });

  it("searches movies", async () => {
    const client = new TvdbClient(tvdbNetwork(), {});
    const items = await client.searchMovie("My Film", "eng");
    expect(items?.[0]?.tvdb_id).toBe("2");
  });

  it("passes ISO 639-3 language straight through to search", async () => {
    const searchUrls: string[] = [];
    const client = new TvdbClient(tvdbNetwork(searchUrls), {});
    await client.searchSeries("My Show", "eng");
    await client.searchMovie("My Film", "jpn");
    await client.searchSeries("My Show", "zho");
    expect(searchUrls[0]).toContain("language=eng");
    expect(searchUrls[1]).toContain("language=jpn");
    expect(searchUrls[2]).toContain("language=zho");
  });

  it("getTvShowMediaMetadata builds seasons + episodes", async () => {
    const client = new TvdbClient(tvdbNetwork(), {});
    const tvShow = await client.getTvShowMediaMetadata(1, "eng");
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

  it("getTvShowMediaMetadata localizes episode names when nameTranslations includes language", async () => {
    const network: NetworkPort = {
      fetch: async (url) => {
        if (url.includes("/series/1/translations/zho")) {
          return jsonResponse(envelope({ name: "天使降临到了我身边！" }));
        }
        if (url.includes("/series/1/extended")) {
          return jsonResponse(
            envelope({
              id: 1,
              name: "Wataten",
              firstAired: "2019-01-08",
              seasons: [{ id: 11, number: 1, type: { name: "Aired Order" } }],
            }),
          );
        }
        if (url.includes("/seasons/11/extended")) {
          return jsonResponse(
            envelope({
              id: 11,
              episodes: [
                {
                  id: 101,
                  number: 1,
                  seasonNumber: 1,
                  name: "もにょっとした気持ち",
                  nameTranslations: ["zho", "eng"],
                },
              ],
            }),
          );
        }
        if (url.includes("/episodes/101/translations/zho")) {
          return jsonResponse(envelope({ name: "心裏癢癢的感覺" }));
        }
        throw new Error("unexpected url: " + url);
      },
    };
    const client = new TvdbClient(network, {});
    const tvShow = await client.getTvShowMediaMetadata(1, "zho");
    expect(tvShow?.name).toBe("天使降临到了我身边！");
    expect(tvShow?.seasons[0]?.episodes[0]?.name).toBe("心裏癢癢的感覺");
  });

  it("getTvShowMediaMetadata fetches episode translations in parallel", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const network: NetworkPort = {
      fetch: async (url) => {
        if (url.includes("/series/1/translations/zho")) {
          return jsonResponse(envelope({ name: "Show" }));
        }
        if (url.includes("/series/1/extended")) {
          return jsonResponse(
            envelope({
              id: 1,
              name: "Show",
              firstAired: "2020-01-01",
              seasons: [{ id: 11, number: 1, type: { name: "Aired Order" } }],
            }),
          );
        }
        if (url.includes("/seasons/11/extended")) {
          return jsonResponse(
            envelope({
              id: 11,
              episodes: [
                { id: 101, number: 1, seasonNumber: 1, name: "E1", nameTranslations: ["zho"] },
                { id: 102, number: 2, seasonNumber: 1, name: "E2", nameTranslations: ["zho"] },
                { id: 103, number: 3, seasonNumber: 1, name: "E3", nameTranslations: ["zho"] },
              ],
            }),
          );
        }
        const m = url.match(/\/episodes\/(\d+)\/translations\/zho/);
        if (m) {
          inFlight += 1;
          maxInFlight = Math.max(maxInFlight, inFlight);
          await new Promise((r) => setTimeout(r, 30));
          inFlight -= 1;
          return jsonResponse(envelope({ name: `T${m[1]}` }));
        }
        throw new Error("unexpected url: " + url);
      },
    };
    const client = new TvdbClient(network, {});
    const tvShow = await client.getTvShowMediaMetadata(1, "zho");
    expect(tvShow?.seasons[0]?.episodes.map((e) => e.name)).toEqual(["T101", "T102", "T103"]);
    expect(maxInFlight).toBeGreaterThan(1);
  });

  it("getMovieMediaMetadata maps a movie", async () => {
    const client = new TvdbClient(tvdbNetwork(), {});
    const movie = await client.getMovieMediaMetadata(2, "eng");
    expect(movie).toEqual({ id: "2", name: "My Film", airDate: "2019-05-01", database: "TVDB" });
  });

  it("getLanguages returns language records", async () => {
    const network: NetworkPort = {
      fetch: async (url) => {
        expect(url).toContain("/languages");
        return jsonResponse(envelope([{ id: "zho", name: "Chinese" }]));
      },
    };
    const client = new TvdbClient(network, {});
    const langs = await client.getLanguages();
    expect(langs?.[0]?.id).toBe("zho");
  });

  it("keeps mapToTvdbLangCode helper", () => {
    expect(mapToTvdbLangCode("zh-CN")).toBe("zho");
    expect(mapToTvdbLangCode("en-US")).toBe("eng");
    expect(mapToTvdbLangCode("ja-JP")).toBe("jpn");
  });
});
